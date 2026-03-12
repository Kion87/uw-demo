import type { Deposit, DepositAddress } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";
import { createError } from "h3";

function toDisplayNetwork(assetKey: string) {
  if (assetKey === "BTC") return "BTC (Bitcoin)";
  if (assetKey === "ETH") return "ETH (Ethereum)";
  if (assetKey === "USDT_ERC20") return "USDT (ERC-20)";
  if (assetKey === "USDT_TRC20") return "USDT (TRC20)";
  if (assetKey === "USDT_BEP20") return "USDT (BEP20)";
  if (assetKey === "TRX") return "TRX (Tron)";
  if (assetKey === "SOL") return "SOL (Solana)";
  if (assetKey === "USDC_SPL") return "USDC (SPL / Solana)";
  if (assetKey === "USDC_ERC20") return "USDC (ERC-20)";
  return assetKey;
}

function isCompletedStatus(status?: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === "transaction_confirmed" ||
    s === "transaction_complete" ||
    s === "confirmed" ||
    s === "complete"
  );
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const [addresses, deposits, totalDeposits, completedDeposits]: [
    DepositAddress[],
    Deposit[],
    number,
    number,
  ] = await Promise.all([
    prisma.depositAddress.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" as any },
    }),
    prisma.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.deposit.count({
      where: { userId: user.id },
    }),
    prisma.deposit.count({
      where: {
        userId: user.id,
        status: {
          in: [
            "transaction_confirmed",
            "transaction_complete",
            "confirmed",
            "complete",
          ],
          mode: "insensitive",
        },
      },
    }),
  ]);

  // OPTION B:
  // Real balances should come from credited ledger / wallet balances,
  // not from deposit sums.
  // For now keep this empty until crediting logic is added.
  const balances: Array<{ asset: string; amount: string }> = [];

  const activity = [
    ...addresses.map((a: DepositAddress) => ({
      type: "address_assigned",
      label: `${toDisplayNetwork(a.assetKey)} address assigned`,
      timestamp: a.createdAt,
      meta: a.address,
    })),
    ...deposits.map((d: Deposit) => ({
      type: isCompletedStatus(d.status)
        ? "deposit_completed"
        : "deposit_update",
      label: isCompletedStatus(d.status)
        ? `${d.asset} deposit completed`
        : `${d.asset} deposit ${d.status || "updated"}`,
      timestamp: d.updatedAt,
      meta: d.amount ? `${d.amount} ${d.asset}` : d.asset,
    })),
  ]
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .slice(0, 8);

  return {
    ok: true,
    user: {
      publicId: user.publicId,
      email: user.email,
    },
    summary: {
      assignedAddresses: addresses.length,
      totalDeposits,
      completedDeposits,
      activeBalances: balances.length,
    },
    balances,
    addresses: addresses.map((a: DepositAddress) => ({
      assetKey: a.assetKey,
      networkLabel: toDisplayNetwork(a.assetKey),
      address: a.address,
      invoiceId: a.invoiceId,
      createdAt: a.createdAt,
    })),
    recentDeposits: deposits.map((d: Deposit) => ({
      id: d.id,
      asset: d.asset,
      network: d.network,
      amount: d.amount,
      status: d.status,
      txid: d.txid,
      address: d.address,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    latestActivity: activity,
  };
});
