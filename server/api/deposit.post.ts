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

  // Build invoice payload per official docs
  const payload: any = {
    profile_id: process.env.UNIWIRE_PROFILE_ID,
    currency: assetConfig.currency,
    kind: assetConfig.kind,
    passthrough: String(user.id), // so webhooks can map back to user
  };

  if (amount) {
    payload.amount = amount;
  }

  // Create invoice at Uniwire
  const invoice = await uniwireRequest<any>("/v1/invoices/", payload, "POST");

  // Store deposit locally
  const deposit = await prisma.deposit.create({
    data: {
      userId: user.id,
      asset: assetConfig.currency,
      network: assetConfig.kind,
      ...(amount && { amount }),
      uniwireInvoiceId: invoice.id,
      address: invoice.address,
      status: invoice.status,
    },
  });

  return {
    ok: true,
    deposit,
  };
});
