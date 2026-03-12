import prisma from "~/server/utils/prisma";
import { requireUser } from "~/server/utils/auth";

function toDisplayNetwork(assetKey: string) {
  if (assetKey === "ETH") return "ETH / ERC20";
  if (assetKey === "TRX") return "TRX / TRC20";
  if (assetKey === "BTC") return "BTC";
  if (assetKey === "SOL") return "SOL";
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

  const [addresses, deposits] = await Promise.all([
    prisma.depositAddress.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" as any },
    }),
    prisma.deposit.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  // OPTION B:
  // Real balances should come from credited ledger / wallet balances,
  // not from deposit sums.
  // For now keep this empty until crediting logic is added.
  const balances: Array<{ asset: string; amount: string }> = [];

  const activity = [
    ...addresses.map((a) => ({
      type: "address_assigned",
      label: `${toDisplayNetwork(a.assetKey)} address assigned`,
      timestamp: a.createdAt,
      meta: a.address,
    })),
    ...deposits.map((d) => ({
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
      totalDeposits: deposits.length,
      completedDeposits: deposits.filter((d) => isCompletedStatus(d.status))
        .length,
      activeBalances: balances.length,
    },
    balances,
    addresses: addresses.map((a) => ({
      assetKey: a.assetKey,
      networkLabel: toDisplayNetwork(a.assetKey),
      address: a.address,
      invoiceId: a.invoiceId,
      createdAt: a.createdAt,
    })),
    recentDeposits: deposits.map((d) => ({
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
