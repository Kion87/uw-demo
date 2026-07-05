import { getCookie, setResponseStatus } from "h3";
import { prisma } from "./prisma";
import { SESSION_COOKIE } from "./session";

export async function requireUser(event: any) {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) {
    setResponseStatus(event, 401);
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          publicId: true,
          email: true,
          createdAt: true,
          fixedAmountInvoices: true,
        },
      },
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    setResponseStatus(event, 401);
    return null;
  }

  return session.user;
}
