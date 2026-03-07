import { PrismaClient } from "@prisma/client";
import { getCookie, createError } from "h3";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const token = getCookie(event, "session");

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const deposits = await prisma.deposit.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return {
    ok: true,
    deposits,
  };
});
