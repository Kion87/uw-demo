import crypto from "node:crypto";
import { Prisma, type Withdrawal } from "@prisma/client";
import { requireUser } from "../../server/utils/auth";
import { prisma } from "../../server/utils/prisma";
import { uniwireRequest } from "../../server/utils/uniwire";
import { getAvailableBalances } from "../../server/utils/balances";
import { DEPOSIT_ASSET_BY_KEY, type DepositAssetKey } from "~/shared/deposits";

class InsufficientBalanceError extends Error {}

async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      if (e?.code === "P2034" && attempt < retries) continue;
      throw e;
    }
  }
  throw new Error("unreachable");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) return { ok: false };

  const body = await readBody(event);

  const { assetKey, amount, address } = body as {
    assetKey: DepositAssetKey;
    amount?: string;
    address?: string;
  };

  if (!assetKey || !DEPOSIT_ASSET_BY_KEY[assetKey]) {
    throw createError({ statusCode: 400, statusMessage: "Invalid asset" });
  }

  const requestedAmount = Number(amount);
  if (!amount || !Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid amount" });
  }

  if (!address || !address.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Destination address is required",
    });
  }

  const assetConfig = DEPOSIT_ASSET_BY_KEY[assetKey];
  const destinationAddress = address.trim();
  const referenceId = crypto.randomUUID();

  // 1) Reserve the balance and create the ticket BEFORE contacting Uniwire,
  // so a network failure on the next step never leaves us with no record of
  // an attempt. Serializable isolation prevents two concurrent requests from
  // both reading the same available balance and both reserving against it.
  let withdrawal: Withdrawal;
  try {
    withdrawal = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const available = await getAvailableBalances(user.id, tx);
          const availableAmount =
            available.get(assetConfig.currency)?.amount ?? 0;

          if (requestedAmount > availableAmount) {
            throw new InsufficientBalanceError();
          }

          return tx.withdrawal.create({
            data: {
              userId: user.id,
              asset: assetConfig.currency,
              network: assetConfig.kind,
              amount,
              destinationAddress,
              referenceId,
              status: "reserved",
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  } catch (e) {
    if (e instanceof InsufficientBalanceError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Insufficient balance",
      });
    }
    throw e;
  }

  // 2) Attempt the payout. reference_id is sent on every attempt (including
  // the retry below) so Uniwire can safely dedupe if we end up sending the
  // same request twice.
  const passthrough =
    (user.publicId ? String(user.publicId).replace(/^ID/i, "") : null) ??
    String(user.id).padStart(4, "0");

  async function attemptPayout() {
    return uniwireRequest<any>(
      "/v1/payouts/",
      {
        kind: assetConfig.kind,
        profile_id: process.env.UNIWIRE_PROFILE_ID,
        passthrough,
        reference_id: referenceId,
        recipients: [
          {
            amount,
            currency: assetConfig.currency,
            address: destinationAddress,
          },
        ],
      },
      "POST",
    );
  }

  async function handleAttempt(): Promise<"success" | "rejected" | "ambiguous"> {
    try {
      const res = await attemptPayout();
      const payout = res?.result ?? res?.content?.result;

      if (!payout?.id) {
        console.error(
          "Unexpected Uniwire payout response:",
          JSON.stringify(res, null, 2),
        );
        return "ambiguous";
      }

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          uniwirePayoutId: String(payout.id),
          txid: payout.txid ?? null,
          status: "pending",
        },
      });
      return "success";
    } catch (e: any) {
      // A structured error response from Uniwire (e.g. InvalidAddress,
      // InsufficientFunds) is a clear rejection - release the reservation.
      // Anything else (timeout, network error, no parseable body) is
      // ambiguous - the payout might have gone through, so we must not
      // release the funds; only a callback can resolve it from here.
      const reason = e?.data?.reason;
      if (reason) {
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "rejected",
            errorMessage: `${reason}: ${e.data.message ?? ""}`.trim(),
          },
        });
        return "rejected";
      }

      console.error("Ambiguous Uniwire payout error:", e);
      return "ambiguous";
    }
  }

  const outcome = await handleAttempt();

  if (outcome === "ambiguous") {
    await sleep(500);
    await handleAttempt();
    // If still ambiguous, the withdrawal stays "reserved" - a later
    // payout_* callback (matched by referenceId) resolves it.
  }

  const finalWithdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawal.id },
  });

  return { ok: true, withdrawal: finalWithdrawal };
});
