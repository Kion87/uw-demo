import { requireUser } from "../../server/utils/auth";
import { prisma } from "../../server/utils/prisma";
import { uniwireRequest } from "../../server/utils/uniwire";
import { DEPOSIT_ASSET_BY_KEY, type DepositAssetKey } from "~/shared/deposits";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) return { ok: false };

  const body = await readBody(event);

  const { assetKey, amount, amountCurrency } = body as {
    assetKey: DepositAssetKey;
    amount?: string;
    amountCurrency?: "usd" | "crypto";
  };

  if (!assetKey || !DEPOSIT_ASSET_BY_KEY[assetKey]) {
    throw createError({ statusCode: 400, statusMessage: "Invalid asset" });
  }

  const assetConfig = DEPOSIT_ASSET_BY_KEY[assetKey];
  const isUsdAmount = Boolean(amount) && amountCurrency === "usd";

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

  // Create invoice on Uniwire. `kind` is always the asset/network; `currency`
  // is what the amount below is denominated in - Uniwire accepts a fiat
  // currency here and computes the crypto equivalent itself (amount.invoiced
  // in the response), which is more accurate than us guessing a rate, since
  // it's the same figure Uniwire uses to judge the invoice fully paid.
  const payload: any = {
    profile_id: process.env.UNIWIRE_PROFILE_ID,
    currency: isUsdAmount ? "USD" : assetConfig.currency,
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

  // Uniwire always echoes back both figures regardless of which currency the
  // request used - `invoiced` is the actual crypto amount the address expects
  // on-chain; `requested` mirrors whatever currency/amount we sent.
  const invoicedAmount =
    inv.amount?.invoiced?.amount != null
      ? String(inv.amount.invoiced.amount)
      : amount;
  const requestedFiatAmount = isUsdAmount
    ? String(inv.amount?.requested?.amount ?? amount)
    : null;

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

  // Fixed-amount invoices: store the deposit row now, since it's the sole
  // record the invoice_* callback will later update (updateMany only, never
  // creates). Reusable addresses have no such row yet - creating one here
  // would show up as a phantom "pending deposit" before any money moves, since
  // the transaction_* callback (which finds its owner via DepositAddress, not
  // Deposit) creates its own row once an actual deposit arrives.
  const deposit = amount
    ? await prisma.deposit.create({
        data: {
          userId: user.id,
          asset: assetConfig.currency,
          network: assetConfig.kind,
          requestedAmount: invoicedAmount,
          requestedFiatAmount,
          uniwireInvoiceId: invoiceId,
          address,
          status,
        },
      })
    : null;

  return {
    ok: true,
    deposit: {
      ...deposit,
      address,
      asset: assetConfig.currency,
      network: assetConfig.kind,
      reused: false,
      passthrough,
    },
  };
});
