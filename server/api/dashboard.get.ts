import type { Deposit, DepositAddress, Withdrawal } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";
import { createError } from "h3";
import { DEPOSIT_ASSET_BY_KEY, type DepositAssetKey } from "~/shared/deposits";
import {
  COMPLETED_STATUSES,
  isCompletedStatus,
  getAvailableBalances,
} from "../utils/balances";

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

function withdrawalActivityStatus(status: string) {
  if (status === "confirmed") return "completed";
  if (status === "rejected" || status === "failed") return "failed";
  return "pending";
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const [
    addresses,
    recentDeposits,
    recentWithdrawals,
    totalDeposits,
    completedDeposits,
    totalWithdrawals,
    grossFiatDeposits,
    grossFiatWithdrawals,
    availableBalances,
  ] = await Promise.all([
    prisma.depositAddress.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" as any },
    }),
    prisma.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.deposit.count({
      where: { userId: user.id },
    }),
    prisma.deposit.count({
      where: {
        userId: user.id,
        status: { in: COMPLETED_STATUSES, mode: "insensitive" },
      },
    }),
    prisma.withdrawal.count({
      where: { userId: user.id },
    }),
    prisma.deposit.aggregate({
      where: { userId: user.id },
      _sum: { fiatAmount: true },
    }),
    prisma.withdrawal.aggregate({
      where: { userId: user.id },
      _sum: { fiatAmount: true },
    }),
    getAvailableBalances(user.id),
  ]);

  const balances = [...availableBalances.entries()].map(([asset, bal]) => ({
    asset,
    label: asset,
    amount: bal.amount.toString(),
    usdValue: bal.fiatValue,
    credited: bal.fiatValue > 0,
  }));

  const totalBalanceUsd = balances.reduce((sum, b) => sum + b.usdValue, 0);

  const assignedAssetKeys = new Set(
    addresses.map(
      (a: DepositAddress) =>
        DEPOSIT_ASSET_BY_KEY[a.assetKey as DepositAssetKey]?.currency ??
        a.assetKey,
    ),
  );

  const activity = [
    ...recentDeposits.map((d: Deposit) => ({
      id: `deposit-${d.id}`,
      type: "deposit" as const,
      asset: d.asset,
      amount: d.amount?.toString() ?? null,
      status: isCompletedStatus(d.status) ? "completed" : "pending",
      createdAt: d.createdAt,
      txid: d.txid,
    })),
    ...recentWithdrawals.map((w: Withdrawal) => ({
      id: `withdrawal-${w.id}`,
      type: "withdrawal" as const,
      asset: w.asset,
      amount: w.amount.toString(),
      status: withdrawalActivityStatus(w.status),
      createdAt: w.createdAt,
      txid: w.txid,
    })),
  ]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);

  return {
    ok: true,
    user: {
      publicId: user.publicId,
      email: user.email,
    },
    totalBalanceUsd,
    balances,
    stats: {
      totalDepositsUsd: Number(grossFiatDeposits._sum.fiatAmount ?? 0),
      totalDepositsCount: totalDeposits,
      totalWithdrawalsUsd: Number(grossFiatWithdrawals._sum.fiatAmount ?? 0),
      totalWithdrawalsCount: totalWithdrawals,
      pendingDepositsCount: totalDeposits - completedDeposits,
      assignedAddressesCount: addresses.length,
      assignedAddressesNetworks: [...assignedAssetKeys].join(", ") || "—",
    },
    recentActivity: activity,
    addresses: addresses.map((a: DepositAddress) => ({
      assetKey: a.assetKey,
      networkLabel: toDisplayNetwork(a.assetKey),
      address: a.address,
      invoiceId: a.invoiceId,
      createdAt: a.createdAt,
    })),
  };
});
