import { prisma } from "../utils/prisma";

function formatUserId(id: number) {
  return id.toString().padStart(4, "0");
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event);

  const email = body?.email?.trim().toLowerCase();
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: "Email is required" });
  }

  // Demo behavior: if user already exists, just return it
  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({ data: { email } }));

  return {
    ok: true,
    user: {
      id: user.id,
      idFormatted: formatUserId(user.id),
      email: user.email,
      createdAt: user.createdAt,
    },
  };
});
