import { PrismaClient } from "@prisma/client";

// Allow SUPABASE_DB_URL as a fallback for Prisma
if (!process.env.DATABASE_URL && process.env.SUPABASE_DB_URL) {
  process.env.DATABASE_URL = process.env.SUPABASE_DB_URL;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
