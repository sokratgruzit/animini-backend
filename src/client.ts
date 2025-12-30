import { PrismaClient } from '@prisma/client';

declare global {
  // добавляем поле prisma в глобальный объект
  var prisma: PrismaClient | undefined;
}

const client = globalThis.prisma || new PrismaClient();
if (!globalThis.prisma) globalThis.prisma = client;

export const prisma = client;
