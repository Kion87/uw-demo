import { createError } from "h3";
import { prisma } from "../utils/prisma";
import { requireUser } from "../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const deposits = await prisma.deposit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return {
    ok: true,
    deposits,
  };
});
