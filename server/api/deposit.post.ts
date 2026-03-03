import { requireUser } from "../../server/utils/auth";
import { prisma } from "../../server/utils/prisma";
import { uniwireRequest } from "../../server/utils/uniwire";
import { DEPOSIT_ASSET_BY_KEY, type DepositAssetKey } from "~/shared/deposits";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) return { ok: false };

  const body = await readBody(event);

  const { assetKey, amount } = body as {
    assetKey: DepositAssetKey;
    amount?: string;
  };

  if (!assetKey || !DEPOSIT_ASSET_BY_KEY[assetKey]) {
    throw createError({ statusCode: 400, statusMessage: "Invalid asset" });
  }

  const assetConfig = DEPOSIT_ASSET_BY_KEY[assetKey];
  // 1) Reuse saved address per user+assetKey
  const reuseKey = String(assetConfig.kind); // e.g. "TRX", "ETH", "SOL"

  let existing = await prisma.depositAddress.findUnique({
    where: { userId_assetKey: { userId: user.id, assetKey: reuseKey } },
  });

  if (!existing) {
    existing = await prisma.depositAddress.findUnique({
      where: {
        userId_assetKey: { userId: user.id, assetKey: String(assetKey) },
      },
    });
  }

  if (existing) {
    return {
      ok: true,
      deposit: {
        address: existing.address,
        asset: assetConfig.currency,
        network: assetConfig.kind,
        reused: true,
      },
    };
  }

  // 2) passthrough should be "0001" style (prefer publicId, fallback to padded id)
  const passthrough =
    (user.publicId ? String(user.publicId).replace(/^ID/i, "") : null) ??
    String(user.id).padStart(4, "0");

  // 3) Create invoice on Uniwire
  const payload: any = {
    profile_id: process.env.UNIWIRE_PROFILE_ID,
    currency: assetConfig.currency,
    kind: assetConfig.kind,
    passthrough,
  };

  // Optional amount (you said you'll leave empty for reusable addresses)
  if (amount) payload.amount = amount;

  const invoiceResponse = await uniwireRequest<any>(
    "/v1/invoices/",
    payload,
    "POST",
  );

  // uniwireRequest() may return { result: {...} } OR { content: { result: {...} } }
  const inv = invoiceResponse?.result ?? invoiceResponse?.content?.result;

  if (!inv?.id || !inv?.address) {
    console.error(
      "Unexpected Uniwire response:",
      JSON.stringify(invoiceResponse, null, 2),
    );
    throw createError({
      statusCode: 502,
      statusMessage: "Uniwire did not return an address",
    });
  }

  const invoiceId = String(inv.id);
  const address = String(inv.address);
  const status = String(inv.status ?? "new");

  // 4) Save reusable address for this user+assetKey
  await prisma.depositAddress.create({
    data: {
      userId: user.id,
      assetKey: reuseKey,
      invoiceId,
      address,
    },
  });

  // 5) Store deposit request in history/audit table
  const deposit = await prisma.deposit.create({
    data: {
      userId: user.id,
      asset: assetConfig.currency,
      network: assetConfig.kind,
      ...(amount ? { amount } : {}),
      uniwireInvoiceId: invoiceId,
      address,
      status,
    },
  });

  return {
    ok: true,
    deposit: {
      ...deposit,
      reused: false,
      passthrough,
    },
  };
});
