import type { Deposit, DepositAddress } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";
import { createError } from "h3";
import { DEPOSIT_ASSET_BY_KEY, type DepositAssetKey } from "~/shared/deposits";

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

const COMPLETED_STATUSES = [
  "transaction_confirmed",
  "transaction_complete",
  "confirmed",
  "complete",
];

function isCompletedStatus(status?: string | null) {
  if (!status) return false;
  return COMPLETED_STATUSES.includes(status.toLowerCase());
}

const ASSET_LABELS: Record<string, string> = {
  USD: "Cash (USD)",
};

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
    totalDeposits,
    completedDeposits,
    creditedByAsset,
    grossFiatTotal,
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
    prisma.deposit.count({
      where: { userId: user.id },
    }),
    prisma.deposit.count({
      where: {
        userId: user.id,
        status: { in: COMPLETED_STATUSES, mode: "insensitive" },
      },
    }),
    prisma.deposit.groupBy({
      by: ["asset"],
      where: {
        userId: user.id,
        status: { in: COMPLETED_STATUSES, mode: "insensitive" },
      },
      _sum: { amount: true, fiatAmount: true },
    }),
    prisma.deposit.aggregate({
      where: { userId: user.id },
      _sum: { fiatAmount: true },
    }),
  ]);

  const creditedAssets = new Set(creditedByAsset.map((row) => row.asset));

  const balances = [
    ...(creditedAssets.has("USD")
      ? []
      : [
          {
            asset: "USD",
            label: ASSET_LABELS.USD,
            amount: null as string | null,
            usdValue: 0,
            credited: false,
          },
        ]),
    ...creditedByAsset.map((row) => ({
      asset: row.asset,
      label: ASSET_LABELS[row.asset] ?? row.asset,
      amount: row._sum.amount?.toString() ?? null,
      usdValue: Number(row._sum.fiatAmount ?? 0),
      credited: Number(row._sum.fiatAmount ?? 0) > 0,
    })),
  ];

  const totalBalanceUsd = balances.reduce((sum, b) => sum + b.usdValue, 0);

  const assignedAssetKeys = new Set(
    addresses.map(
      (a: DepositAddress) =>
        DEPOSIT_ASSET_BY_KEY[a.assetKey as DepositAssetKey]?.currency ??
        a.assetKey,
    ),
  );

  return {
    ok: true,
    user: {
      publicId: user.publicId,
      email: user.email,
    },
    totalBalanceUsd,
    balances,
    stats: {
      totalDepositsUsd: Number(grossFiatTotal._sum.fiatAmount ?? 0),
      totalDepositsCount: totalDeposits,
      totalWithdrawalsUsd: 0,
      totalWithdrawalsCount: 0,
      pendingDepositsCount: totalDeposits - completedDeposits,
      assignedAddressesCount: addresses.length,
      assignedAddressesNetworks: [...assignedAssetKeys].join(", ") || "—",
    },
    recentActivity: recentDeposits.map((d: Deposit) => ({
      id: d.id,
      type: "deposit" as const,
      asset: d.asset,
      amount: d.amount?.toString() ?? null,
      status: isCompletedStatus(d.status) ? "completed" : "pending",
      createdAt: d.createdAt,
      txid: d.txid,
    })),
    addresses: addresses.map((a: DepositAddress) => ({
      assetKey: a.assetKey,
      networkLabel: toDisplayNetwork(a.assetKey),
      address: a.address,
      invoiceId: a.invoiceId,
      createdAt: a.createdAt,
    })),
  };
});
