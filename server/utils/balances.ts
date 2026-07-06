import { prisma } from "./prisma";

export const COMPLETED_STATUSES = [
  "transaction_confirmed",
  "transaction_complete",
  "confirmed",
  "complete",
  "invoice_complete",
];

export function isCompletedStatus(status?: string | null) {
  if (!status) return false;
  return COMPLETED_STATUSES.includes(status.toLowerCase());
}

// Withdrawal statuses that no longer reserve a balance (funds never left / never will)
const NON_RESERVING_WITHDRAWAL_STATUSES = ["rejected", "failed"];

export type AssetBalance = {
  amount: number;
  fiatValue: number;
};

type BalanceClient = Pick<typeof prisma, "deposit" | "withdrawal">;

export async function getAvailableBalances(
  userId: number,
  client: BalanceClient = prisma,
): Promise<Map<string, AssetBalance>> {
  const [credited, reserved] = await Promise.all([
    client.deposit.groupBy({
      by: ["asset"],
      where: {
        userId,
        status: { in: COMPLETED_STATUSES, mode: "insensitive" },
      },
      _sum: { amount: true, fiatAmount: true },
    }),
    client.withdrawal.groupBy({
      by: ["asset"],
      where: {
        userId,
        status: { notIn: NON_RESERVING_WITHDRAWAL_STATUSES },
      },
      _sum: { amount: true },
    }),
  ]);

  const balances = new Map<string, AssetBalance>();

  for (const row of credited) {
    balances.set(row.asset, {
      amount: Number(row._sum.amount ?? 0),
      fiatValue: Number(row._sum.fiatAmount ?? 0),
    });
  }

  for (const row of reserved) {
    const existing = balances.get(row.asset) ?? { amount: 0, fiatValue: 0 };
    existing.amount -= Number(row._sum.amount ?? 0);
    balances.set(row.asset, existing);
  }

  return balances;
}
