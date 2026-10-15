import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL ||
    "";

  if (!connectionString) {
    console.warn("WARNING: DATABASE_URL and DIRECT_URL are not set. Ensure they are configured in Vercel environment variables.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

