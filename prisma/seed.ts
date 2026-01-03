import {
  PrismaClient,
  TransactionType,
  TransactionStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 1;

  console.log('Start seeding transactions...');

  const transactions = Array.from({ length: 50 }).map((_, i) => ({
    userId,
    amount: Math.floor(Math.random() * 1000) + 10,
    type:
      i % 3 === 0 ? TransactionType.DEPOSIT : TransactionType.USER_VOTE_COST,
    status: TransactionStatus.COMPLETED,
    createdAt: new Date(Date.now() - i * 3600000),
  }));

  await prisma.transaction.createMany({
    data: transactions,
  });

  console.log('Seeding finished: 50 transactions created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
