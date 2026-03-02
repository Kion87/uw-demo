import { prisma } from "../utils/prisma";

export default defineEventHandler(async () => {
  const userCount = await prisma.user.count();
  const addressCount = await prisma.depositAddress.count();

  return {
    ok: true,
    userCount,
    addressCount,
  };
});
