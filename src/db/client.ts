import { PrismaClient } from "@prisma/client";

const globalDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const database =
  globalDatabase.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalDatabase.prisma = database;
}

export async function checkDatabaseConnection(): Promise<void> {
  await database.$queryRaw`SELECT 1`;
}
