import { prisma } from '../client';
import {
  TransactionType,
  TransactionStatus,
  VideoStatus,
  ReviewType,
} from '@prisma/client';
import { calculateFiatAmount } from '../utils';
import { loggerService } from '../services/logger-service';
import { PAYMENT_CURRENCY, VIDEO_ECONOMY } from '../constants';

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

  public async updateExternalId(transactionId: string, externalId: string) {
    return await prisma.transaction.update({
      where: { id: transactionId },
      data: { externalId },
    });
  }

  public async completeDeposit(transactionId: string) {
    return await prisma.$transaction(async (tx) => {
      const updatedTransaction = await tx.transaction.updateMany({
        where: {
          id: transactionId,
          status: TransactionStatus.PENDING,
        },
        data: {
          status: TransactionStatus.COMPLETED,
        },
      });

      if (updatedTransaction.count === 0) {
        return null;
      }

      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) return null;

      const updatedUser = await tx.user.update({
        where: { id: transaction.userId },
        data: {
          balance: { increment: transaction.amount },
        },
      });

      return updatedUser;
    });
  }

  public async getTransactionById(transactionId: string) {
    return await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  public async syncTransactionStatus(
    transactionId: string
  ): Promise<TransactionStatus> {
    const transaction = await this.getTransactionById(transactionId);

    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      return transaction?.status || TransactionStatus.FAILED;
    }

    if (!transaction.externalId) {
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
          data: { status: TransactionStatus.FAILED },
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

  public async cancelAbandonedTransactions() {
    const oneHourAgo = new Date(Date.now() - 30 * 60 * 1000);

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

  /**
   * Logic for processing a user vote for a video (Project Series level)
   */
  public async processVideoVote(
    userId: number,
    videoId: string,
    amount: number
  ) {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user || user.balance < amount) {
        throw new Error('Insufficient funds to vote');
      }

      const video = await tx.video.findUnique({
        where: { id: videoId },
        include: {
          series: true, // Now linking to Series for economy tracking
          reviews: {
            where: { isExecuted: true },
            include: { critic: true },
          },
        },
      });

      // Voting is allowed only if video status is not published yet
      if (!video || video.status === VideoStatus.PUBLISHED) {
        throw new Error('Video is not available for voting');
      }

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });

      await tx.vote.create({
        data: {
          userId,
          videoId,
          amount,
        },
      });

      // Update economy on the SERIES level
      const updatedSeries = await tx.series.update({
        where: { id: video.seriesId },
        data: { collectedFunds: { increment: amount } },
      });

      // If project is fully funded, finalize all videos in this series
      if (updatedSeries.collectedFunds >= updatedSeries.votesRequired) {
        await this.finalizeSeriesPool(video.seriesId, tx);
      }

      return video;
    });
  }

  /**
   * Finalizes the series pool and distributes funds.
   */
  private async finalizeSeriesPool(seriesId: string, tx: any) {
    const series = await tx.series.findUnique({
      where: { id: seriesId },
      include: {
        videos: {
          include: {
            reviews: { where: { isExecuted: true }, include: { critic: true } },
          },
        },
      },
    });

    const totalPool = series.collectedFunds;

    // Default shares
    let authorRatio = VIDEO_ECONOMY.BASE_SHARES.AUTHOR;
    let platformRatio = VIDEO_ECONOMY.BASE_SHARES.PLATFORM;
    let criticRatio = VIDEO_ECONOMY.BASE_SHARES.CRITICS;

    // Apply modifiers from all reviews in the series
    for (const video of series.videos) {
      for (const review of video.reviews) {
        const reputationBonus =
          review.critic.reputation * VIDEO_ECONOMY.CRITIC_REPUTATION_WEIGHT;

        if (review.type === ReviewType.NEGATIVE) {
          authorRatio -= VIDEO_ECONOMY.NEGATIVE_REVIEW_PENALTY.AUTHOR_REDUCTION;
          platformRatio +=
            VIDEO_ECONOMY.NEGATIVE_REVIEW_PENALTY.PLATFORM_GAIN +
            reputationBonus;
          criticRatio += VIDEO_ECONOMY.NEGATIVE_REVIEW_PENALTY.CRITIC_GAIN;
        } else {
          platformRatio -=
            VIDEO_ECONOMY.POSITIVE_REVIEW_BOOST.PLATFORM_REDUCTION;
          criticRatio +=
            VIDEO_ECONOMY.POSITIVE_REVIEW_BOOST.CRITIC_GAIN + reputationBonus;
        }
      }
    }

    const authorAmount = Math.floor(totalPool * Math.max(authorRatio, 0));

    // 1. Author Payout
    await tx.user.update({
      where: { id: series.authorId },
      data: { balance: { increment: authorAmount } },
    });

    await tx.transaction.create({
      data: {
        userId: series.authorId,
        amount: authorAmount,
        type: TransactionType.AUTHOR_PAYOUT,
        status: TransactionStatus.COMPLETED,
      },
    });

    // 2. Finalize all videos in the series
    await tx.video.updateMany({
      where: { seriesId },
      data: { status: VideoStatus.PUBLISHED },
    });
  }

  public async processReviewVote(userId: number, reviewId: string) {
    return await prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({
        where: { id: reviewId },
      });

      if (!review || review.isExecuted) return review;

      const updatedReview = await tx.review.update({
        where: { id: reviewId },
        data: { currentVotes: { increment: 1 } },
      });

      if (updatedReview.currentVotes >= updatedReview.votesRequired) {
        return await tx.review.update({
          where: { id: reviewId },
          data: { isExecuted: true },
        });
      }

      return updatedReview;
    });
  }
}

export const walletService = new WalletService();
