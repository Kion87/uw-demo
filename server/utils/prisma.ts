import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { PrismaClient } =
  require("@prisma/client") as typeof import("@prisma/client");
const { PrismaBetterSqlite3 } =
  require("@prisma/adapter-better-sqlite3") as typeof import("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL!, // expects: file:./dev.db
});

const globalForPrisma = globalThis as unknown as {
  prisma: import("@prisma/client").PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
