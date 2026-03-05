import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hmacSha256Hex(key: string, msg: string) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function parsePassthroughToPublicId(passthroughRaw: unknown): string | null {
  if (typeof passthroughRaw !== "string") return null;
  const trimmed = passthroughRaw.trim();
  if (!trimmed) return null;

  // sometimes passthrough can be JSON string
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      const candidate =
        obj.publicId ??
        obj.public_id ??
        obj.userPublicId ??
        obj.user_public_id ??
        obj.userId ??
        obj.user_id;

      if (candidate === undefined || candidate === null) return null;
      const s = String(candidate).trim();
      return s || null;
    } catch {
      // fall through
    }
  }

  return trimmed;
}

export default defineEventHandler(async (h3event) => {
  const payload = await readBody<any>(h3event);
  const VERSION = "cb-v7-2026-03-05-2329";

  console.log("WEBHOOK VERSION", VERSION);
  console.log("UNIWIRE CALLBACK HIT", {
    callback_id: payload?.callback_id,
    callback_status: payload?.callback_status,
    has_transaction: !!payload?.transaction,
    has_result: !!payload?.result,
  });

  // --- A) Signature verification ---
  const callbackId = payload?.callback_id;
  const signature = payload?.signature;

  if (!callbackId || !signature) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing callback_id or signature",
    });
  }

  const callbackToken = process.env.UNIWIRE_CALLBACK_TOKEN;
  if (!callbackToken) {
    throw createError({
      statusCode: 500,
      statusMessage: "Server misconfigured: UNIWIRE_CALLBACK_TOKEN missing",
    });
  }

  const expected = hmacSha256Hex(callbackToken, String(callbackId));
  if (!safeEqualHex(String(signature), expected)) {
    throw createError({ statusCode: 401, statusMessage: "Invalid signature" });
  }

  console.log("SIGNATURE OK", VERSION);

  // --- B) Callback idempotency (DO NOT return early on duplicates) ---
  let isDuplicateCallback = false;

  try {
    await prisma.uniwireCallback.create({
      data: { callbackId: String(callbackId) },
    });
    console.log("UNIWIRE CALLBACK SAVED", String(callbackId));
  } catch (e: any) {
    if (e?.code === "P2002") {
      isDuplicateCallback = true;
      console.log("UNIWIRE CALLBACK DUPLICATE", String(callbackId));
      // ✅ Continue processing. Deposit upsert will keep it idempotent.
    } else {
      console.error("UNIWIRE CALLBACK INSERT FAILED", e);
      throw e;
    }
  }

  // --- C) Extract result + detect callback type ---
  const resultObj =
    payload?.transaction ?? payload?.result ?? payload?.content?.result;
  if (!resultObj) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing callback result",
    });
  }

  const callbackStatus = String(payload?.callback_status ?? "");
  const isTransactionCallback = callbackStatus.startsWith("transaction_");

  // Ignore invoice callbacks (return 200 so Uniwire won't retry)
  if (!isTransactionCallback) {
    return {
      ok: true,
      ignored: "invoice_callback",
      version: VERSION,
      duplicateCallback: isDuplicateCallback,
    };
  }

  // --- D) Transaction callback processing ---
  const tx = resultObj;

  // Expect tx.invoice.* to exist
  const invoice = tx?.invoice;
  if (!invoice) {
    throw createError({ statusCode: 400, statusMessage: "Missing tx.invoice" });
  }

  // 1) Find user via passthrough
  const publicId = parsePassthroughToPublicId(invoice?.passthrough);
  if (!publicId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing/invalid passthrough",
    });
  }

  const user = await prisma.user.findUnique({ where: { publicId } });
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found for passthrough",
    });
  }

  // 2) Verify address belongs to user
  const receivingAddress = invoice?.address;
  if (!receivingAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing invoice address",
    });
  }

  const invoiceId = invoice?.id ? String(invoice.id) : null;

  const userAddress = await prisma.depositAddress.findFirst({
    where: {
      userId: user.id,
      OR: [
        ...(invoiceId ? [{ invoiceId }] : []),
        { address: String(receivingAddress) },
      ],
    },
  });

  if (!userAddress) {
    throw createError({
      statusCode: 403,
      statusMessage: "Receiving address not owned by user",
    });
  }

  // 3) Upsert Deposit by TRANSACTION id (unique)
  const uniwireTransactionId = tx?.id ? String(tx.id) : "";
  if (!uniwireTransactionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing transaction id",
    });
  }

  const uniwireInvoiceId = invoiceId ?? "unknown";
  const txid = tx?.txid ? String(tx.txid) : null;

  const asset = String(
    tx?.currency ??
      tx?.asset ??
      // best source in your real payload:
      tx?.amount?.paid?.currency ??
      invoice?.currency ??
      invoice?.asset ??
      "UNKNOWN",
  );

  const network = String(
    tx?.kind ?? tx?.network ?? invoice?.kind ?? invoice?.network ?? "UNKNOWN",
  );

  // Prisma Decimal columns accept string inputs
  function extractDecimalString(v: any): string | null {
    if (v === null || v === undefined) return null;

    if (typeof v === "number") return String(v);
    if (typeof v === "string") return v;

    if (typeof v === "object") {
      const candidates = [
        v.amount,
        v.value,
        v.total,
        v.received,
        v.paid,
        v.expected,
        v.decimal,
        v.raw,
      ];
      for (const c of candidates) {
        if (typeof c === "number") return String(c);
        if (typeof c === "string") return c;
      }
    }

    return null;
  }

  const amount =
    extractDecimalString(tx?.amount?.paid?.amount) ??
    extractDecimalString(tx?.amount?.paid) ??
    extractDecimalString(tx?.amount) ??
    extractDecimalString(tx?.paid_amount) ??
    extractDecimalString(tx?.received_amount) ??
    extractDecimalString(tx?.value) ??
    null;

  const status = callbackStatus || String(tx?.status ?? "unknown");
  const address = String(receivingAddress);

  console.log("TX EXTRACT", {
    tx_id: tx?.id,
    txid: tx?.txid,
    invoice_id: invoice?.id,
    address: invoice?.address,
    passthrough: invoice?.passthrough,
    paid_amount: tx?.amount?.paid?.amount,
    paid_currency: tx?.amount?.paid?.currency,
    callback_status: payload?.callback_status,
    duplicateCallback: isDuplicateCallback,
  });

  try {
    await prisma.deposit.upsert({
      where: { uniwireTransactionId },
      update: {
        status,
        amount,
        asset,
        network,
        address,
        uniwireInvoiceId,
        txid,
      },
      create: {
        userId: user.id,
        asset,
        network,
        amount,
        address,
        status,
        uniwireInvoiceId,
        uniwireTransactionId,
        txid,
      },
    });
  } catch (e: any) {
    console.error("DEPOSIT UPSERT FAILED", e);
    throw e;
  }

  return {
    ok: true,
    version: VERSION,
    duplicateCallback: isDuplicateCallback,
    callbackId: String(callbackId),
    uniwireTransactionId,
  };
});
