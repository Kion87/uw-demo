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

  // Fixed-amount invoices are one-off: never reused, never cached in
  // DepositAddress. Only the amount-less (reusable) flow uses that cache.
  if (!amount) {
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
  }

  // passthrough should be "0001" style (prefer publicId, fallback to padded id)
  const passthrough =
    (user.publicId ? String(user.publicId).replace(/^ID/i, "") : null) ??
    String(user.id).padStart(4, "0");

  // Create invoice on Uniwire
  const payload: any = {
    profile_id: process.env.UNIWIRE_PROFILE_ID,
    currency: assetConfig.currency,
    kind: assetConfig.kind,
    passthrough,
  };

  // Optional amount - fixed-amount invoice flow only
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

  // Save reusable address for this user+assetKey - fixed-amount invoices skip
  // this entirely, since they're one-off and never looked up again.
  if (!amount) {
    await prisma.depositAddress.create({
      data: {
        userId: user.id,
        assetKey: String(assetConfig.kind),
        invoiceId,
        address,
      },
    });
  }

  // Store deposit request in history/audit table. `requestedAmount` is the
  // fixed-invoice ask (immutable); `amount` stays null until invoice_*/
  // transaction_* callbacks report real paid activity.
  const deposit = await prisma.deposit.create({
    data: {
      userId: user.id,
      asset: assetConfig.currency,
      network: assetConfig.kind,
      ...(amount ? { requestedAmount: amount } : {}),
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
