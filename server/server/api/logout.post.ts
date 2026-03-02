import { prisma } from "../utils/prisma";
import { SESSION_COOKIE } from "../utils/session";

export default defineEventHandler(async (event) => {
  const token = getCookie(event, SESSION_COOKIE);

  if (token) {
    // best-effort delete
    await prisma.session.deleteMany({ where: { token } });
  }

  // clear cookie
  setCookie(event, SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return { ok: true };
});
