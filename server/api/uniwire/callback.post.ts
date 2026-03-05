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

  // --- B) Callback idempotency ---
  try {
    await prisma.uniwireCallback.create({
      data: { callbackId: String(callbackId) },
    });
    console.log("UNIWIRE CALLBACK SAVED callbackId", String(callbackId));
  } catch (e: any) {
    if (e?.code === "P2002") {
      return { ok: true, duplicate: true };
    }
    throw e;
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
    return { ok: true, ignored: "invoice_callback" };
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

  const asset = String(tx?.currency ?? invoice?.currency ?? "UNKNOWN");
  const network = String(tx?.kind ?? invoice?.kind ?? "UNKNOWN");

  // Prisma Decimal columns accept string inputs
  const amountRaw =
    tx?.amount ?? tx?.paid_amount ?? tx?.received_amount ?? tx?.value ?? null;

  const amount =
    amountRaw === null || amountRaw === undefined ? null : String(amountRaw);

  const status = callbackStatus || String(tx?.status ?? "unknown");
  const address = String(receivingAddress);

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

  return { ok: true, callbackId: String(callbackId) };
});
