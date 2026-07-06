import type { Deposit, DepositAddress, Withdrawal } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";
import { createError } from "h3";
import { DEPOSIT_ASSET_BY_KEY, type DepositAssetKey } from "~/shared/deposits";
import { COMPLETED_STATUSES, getAvailableBalances } from "../utils/balances";
import { getRatesUsd } from "../utils/rates";

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
  if (status === "confirmed" || status === "complete") return status;
  if (status === "rejected" || status === "failed") return "failed";
  return "pending";
}

function depositActivityStatus(status: string | null) {
  if (status === "invoice_pending" || status === "invoice_confirmed") return "pending";
  if (status === "invoice_complete") return "complete";
  if (status === "underpaid") return "underpaid";

  const s = (status ?? "").toLowerCase();
  if (s.includes("confirm")) return "confirmed";
  if (s.includes("complete")) return "complete";
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
    withdrawalAssetTotals,
    availableBalances,
    rates,
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
    prisma.withdrawal.groupBy({
      by: ["asset"],
      where: { userId: user.id },
      _sum: { amount: true },
    }),
    getAvailableBalances(user.id),
    getRatesUsd(),
  ]);

  const balances = [...availableBalances.entries()].map(([asset, bal]) => {
    if (bal.amount <= 0) {
      return {
        asset,
        label: asset,
        amount: bal.amount.toString(),
        usdValue: 0,
        rateUsd: null as number | null,
        credited: false,
      };
    }

    const rateUsd = rates.get(asset) ?? null;
    const usdValue = rateUsd !== null ? bal.amount * rateUsd : null;

    return {
      asset,
      label: asset,
      amount: bal.amount.toString(),
      usdValue,
      rateUsd,
      credited: true,
    };
  });

  const totalBalanceUsd = balances.some((b) => b.usdValue === null)
    ? null
    : balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0);

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
      requestedAmount: d.requestedAmount?.toString() ?? null,
      requestedFiatAmount: d.requestedFiatAmount?.toString() ?? null,
      usdValue:
        d.fiatAmount !== null && d.fiatAmount !== undefined
          ? Number(d.fiatAmount)
          : null,
      status: depositActivityStatus(d.status),
      createdAt: d.createdAt,
      txid: d.txid,
    })),
    ...recentWithdrawals.map((w: Withdrawal) => {
      const rateUsd = rates.get(w.asset) ?? null;
      const usdValue = rateUsd !== null ? Number(w.amount) * rateUsd : null;
      return {
        id: `withdrawal-${w.id}`,
        type: "withdrawal" as const,
        asset: w.asset,
        amount: w.amount.toString(),
        usdValue,
        status: withdrawalActivityStatus(w.status),
        createdAt: w.createdAt,
        txid: w.txid,
      };
    }),
  ]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 6);

  let totalWithdrawalsUsd: number | null = 0;
  for (const row of withdrawalAssetTotals) {
    const sumAmount = Number(row._sum.amount ?? 0);
    if (sumAmount === 0) continue;

    const rateUsd = rates.get(row.asset) ?? null;
    if (rateUsd === null) {
      totalWithdrawalsUsd = null;
      break;
    }
    totalWithdrawalsUsd = (totalWithdrawalsUsd ?? 0) + sumAmount * rateUsd;
  }

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
      totalWithdrawalsUsd,
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
