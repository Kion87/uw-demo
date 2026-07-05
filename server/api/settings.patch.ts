import { createError, readBody } from "h3";
import { requireUser } from "../utils/auth";
import { prisma } from "../utils/prisma";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<{ fixedAmountInvoices?: boolean }>(event);

  if (typeof body?.fixedAmountInvoices !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "fixedAmountInvoices must be a boolean",
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { fixedAmountInvoices: body.fixedAmountInvoices },
    select: {
      id: true,
      publicId: true,
      email: true,
      createdAt: true,
      fixedAmountInvoices: true,
    },
  });

  return { ok: true, user: updated };
});
