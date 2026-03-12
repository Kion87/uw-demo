import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  const [depositCount, confirmedCount, addressCount, latestDeposit] =
    await Promise.all([
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
          },
        },
      }),
      prisma.depositAddress.count({
        where: { userId: user.id },
      }),
      prisma.deposit.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

  return {
    ok: true,
    user: {
      publicId: user.publicId,
      email: user.email,
    },
    stats: {
      depositCount,
      confirmedCount,
      addressCount,
      latestDeposit: latestDeposit
        ? {
            asset: latestDeposit.asset,
            amount: latestDeposit.amount,
            status: latestDeposit.status,
            txid: latestDeposit.txid,
            updatedAt: latestDeposit.updatedAt,
          }
        : null,
    },
  };
});
