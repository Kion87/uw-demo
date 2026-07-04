// server/api/withdrawals.get.ts
import { createError } from "h3";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";
import { getRatesUsd } from "../utils/rates";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const rates = await getRatesUsd();

  const withdrawalsWithUsd = withdrawals.map((w) => {
    const rateUsd = rates.get(w.asset) ?? null;
    const usdValue = rateUsd !== null ? Number(w.amount) * rateUsd : null;
    return { ...w, usdValue };
  });

  return {
    ok: true,
    withdrawals: withdrawalsWithUsd,
  };
});
