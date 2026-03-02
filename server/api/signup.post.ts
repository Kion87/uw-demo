import { z } from "zod";
import { prisma } from "../utils/prisma";
import {
  makeSessionToken,
  sessionExpiresAt,
  SESSION_COOKIE,
} from "../utils/session";

const BodySchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.trim().toLowerCase()),
});

const formatPublicId = (id: number) => String(id).padStart(4, "0");

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const parsed = BodySchema.safeParse(body);

  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { ok: false, error: "Invalid email" };
  }

  const { email } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    // find or create user
    let user = await tx.user.findUnique({
      where: { email },
      select: { id: true, publicId: true },
    });

    if (!user) {
      const created = await tx.user.create({
        data: { email },
        select: { id: true },
      });
      user = { id: created.id, publicId: null };
    }

    // ensure publicId
    let ensuredPublicId = user.publicId;
    if (!ensuredPublicId) {
      ensuredPublicId = formatPublicId(user.id);
      await tx.user.update({
        where: { id: user.id },
        data: { publicId: ensuredPublicId },
      });
    }

    // create session
    const token = makeSessionToken();
    const expiresAt = sessionExpiresAt(30);

    await tx.session.create({
      data: { token, userId: user.id, expiresAt },
    });

    return { publicId: ensuredPublicId, token, expiresAt };
  });

  // Set HttpOnly cookie
  setCookie(event, SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: result.expiresAt,
  });

  return { ok: true, publicId: result.publicId };
});
