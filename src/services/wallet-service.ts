import { prisma } from '../client';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { calculateFiatAmount } from '../utils';
import { PAYMENT_CURRENCY } from '../constants';

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
          amount,
          type,
          status: TransactionStatus.COMPLETED,
        },
      });

      return updatedUser;
    });
  }

  /**
   * Creates a pending transaction and prepares YooKassa payment data
   * Uses utility for fiat calculation (2026)
   */
  public async createDepositOrder(userId: number, amount: number) {
    const fiatValue = calculateFiatAmount(amount);

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        amount,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      },
    });

    const paymentData = {
      amount: {
        value: fiatValue.toFixed(2),
        currency: PAYMENT_CURRENCY,
      },
      confirmation: {
        type: 'redirect',
        return_url: `${process.env.BASE_URL}/wallet`,
      },
      capture: true,
      description: `Refill balance: ${amount} coins`,
      metadata: {
        transactionId: transaction.id,
        userId: userId.toString(),
      },
    };

    return {
      paymentData,
      transactionId: transaction.id,
    };
  }

  /**
   * NEW: Updates transaction with YooKassa external payment ID
   */
  public async updateExternalId(transactionId: string, externalId: string) {
    return await prisma.transaction.update({
      where: { id: transactionId },
      data: { externalId },
    });
  }

  /**
   * Finalize transaction and update user balance
   */
  public async completeDeposit(transactionId: string) {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction || transaction.status !== TransactionStatus.PENDING) {
        return null;
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.COMPLETED },
      });

      const updatedUser = await tx.user.update({
        where: { id: transaction.userId },
        data: {
          balance: { increment: transaction.amount },
        },
      });

      return updatedUser;
    });
  }

  /**
   * Finds a transaction by its internal UUID
   */
  public async getTransactionById(transactionId: string) {
    return await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
  }
}

export const walletService = new WalletService();
