/* eslint-disable @typescript-eslint/ban-ts-comment */
// lib/prisma.ts
// @ts-ignore
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Singleton global
const prismaClientSingleton = () => {
  const adapter = new PrismaBetterSqlite3({
    url: 'file:./dev.db', // ou process.env.DATABASE_URL si tu utilises .env
  });

  return new PrismaClient({ adapter });
};

declare global {
  var prisma: ReturnType<typeof prismaClientSingleton> | undefined;
}

const prisma = global.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export { prisma };

