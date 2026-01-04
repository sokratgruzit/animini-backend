import { prisma } from '../client';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { calculateFiatAmount } from '../utils';
import { loggerService } from '../services/logger-service';
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
      // 1. Attempt to update ONLY if status is still PENDING
      // This is an atomic operation at the database level
      const updatedTransaction = await tx.transaction.updateMany({
        where: {
          id: transactionId,
          status: TransactionStatus.PENDING,
        },
        data: {
          status: TransactionStatus.COMPLETED,
        },
      });

      // 2. If no rows were updated, it means the transaction was already processed
      // by a concurrent webhook or worker.
      if (updatedTransaction.count === 0) {
        return null;
      }

      // 3. Since we successfully marked it as COMPLETED, now we get the full data
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) return null;

      // 4. Update user balance
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

  /**
   * Syncs a single pending transaction with YooKassa API.
   * This is the core logic for both the background worker and manual checks.
   */
  public async syncTransactionStatus(
    transactionId: string
  ): Promise<TransactionStatus> {
    const transaction = await this.getTransactionById(transactionId);

    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      return transaction?.status || TransactionStatus.FAILED;
    }

    if (!transaction.externalId) {
      // If no externalId exists yet, the user probably never reached YooKassa
      // We can mark it as FAILED if it's too old (e.g., > 30 mins)
      return TransactionStatus.PENDING;
    }

    try {
      const response = await fetch(`api.yookassa.ru{transaction.externalId}`, {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.YCASSA_SHOP_ID}:${process.env.YCASSA_SECRET_KEY}`
            ).toString('base64'),
        },
      });

      const data: any = await response.json();

      if (data.status === 'succeeded') {
        await this.completeDeposit(transactionId);
        return TransactionStatus.COMPLETED;
      }

      if (data.status === 'canceled') {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: TransactionStatus.FAILED }, // Or TransactionStatus.CANCELED
        });
        return TransactionStatus.FAILED;
      }

      return TransactionStatus.PENDING;
    } catch (error) {
      loggerService.error(
        { error, transactionId },
        'Failed to sync transaction status'
      );
      throw error;
    }
  }

  public async getStalePendingTransactions(limit: number = 50) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return prisma.transaction.findMany({
      where: {
        status: TransactionStatus.PENDING,
        createdAt: {
          lt: tenMinutesAgo,
          gt: oneDayAgo,
        },
        externalId: { not: null },
      },
      select: { id: true },
      take: limit,
    });
  }

  /**
   * Marks transactions as FAILED if they have no externalId
   * and were created more than 1 hour ago.
   */
  public async cancelAbandonedTransactions() {
    const oneHourAgo = new Date(Date.now() - 30 * 60 * 1000); //new Date(Date.now() - 60 * 60 * 1000);

    return await prisma.transaction.updateMany({
      where: {
        status: TransactionStatus.PENDING,
        externalId: null,
        createdAt: {
          lt: oneHourAgo,
        },
      },
      data: {
        status: TransactionStatus.FAILED,
      },
    });
  }
}

export const walletService = new WalletService();
