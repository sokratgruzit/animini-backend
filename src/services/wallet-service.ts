import { prisma } from '../client';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class WalletService {
  /**
   * Returns both balance and reputation
   */
  public async getUserBalance(
    userId: number
  ): Promise<{ balance: number; reputation: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, reputation: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      balance: user.balance,
      reputation: user.reputation,
    };
  }

  /**
   * Deposits funds and creates a transaction record
   */
  public async addFunds(userId: number, amount: number) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
        },
      });

      return user;
    });
  }

  /**
   * Paginated transaction history
   */
  public async getTransactions(userId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.transaction.count({
        where: { userId },
      }),
    ]);

    return {
      items,
      total,
    };
  }

  /**
   * Deducts funds and logs the transaction with proper status
   */
  public async deductFunds(
    userId: number,
    amount: number,
    type: TransactionType
  ) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user || user.balance < amount) {
        throw new Error('Insufficient funds');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          amount, // Store absolute amount, type defines the flow
          type,
          status: TransactionStatus.COMPLETED,
        },
      });

      return updatedUser;
    });
  }
}

export const walletService = new WalletService();
