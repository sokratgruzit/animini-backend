import { prisma } from '../client';
import {
  TransactionType,
  TransactionStatus,
  VideoStatus,
  ReviewType,
} from '@prisma/client';
import { calculateFiatAmount } from '../utils';
import { eventService } from './event-service';
import { PAYMENT_CURRENCY, VIDEO_ECONOMY } from '../constants';

export class WalletService {
  /**
   * SSE Helper: Push current balance and reputation to the user's active sessions.
   */
  private async notifyBalanceUpdate(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, reputation: true },
    });

    if (user) {
      eventService.emitToUser(userId, 'BALANCE_UPDATED', {
        balance: user.balance,
        reputation: user.reputation,
      });
    }
  }

  /**
   * Returns both balance and reputation.
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
   * Deposits funds and creates a transaction record.
   * Notifies user instantly via SSE.
   */
  public async addFunds(userId: number, amount: number) {
    const result = await prisma.$transaction(async (tx) => {
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

    // Reactive sync
    await this.notifyBalanceUpdate(userId);
    eventService.emitToUser(userId, 'TRANSACTION_SUCCESS', {
      message: `Successfully deposited ${amount} coins.`,
    });

    return result;
  }

  /**
   * Paginated transaction history.
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
   * Deducts funds and logs the transaction.
   * Triggers real-time balance update.
   */
  public async deductFunds(
    userId: number,
    amount: number,
    type: TransactionType
  ) {
    const result = await prisma.$transaction(async (tx) => {
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

    await this.notifyBalanceUpdate(userId);
    return result;
  }

  /**
   * Creates a pending transaction and prepares YooKassa payment data.
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

  /**
   * Finalizes a pending deposit (e.g., after successful YooKassa webhook).
   */
  public async completeDeposit(transactionId: string) {
    const result = await prisma.$transaction(async (tx) => {
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

    if (result) {
      await this.notifyBalanceUpdate(result.id);
      eventService.emitToUser(result.id, 'TRANSACTION_SUCCESS', {
        message: 'Your payment was processed successfully!',
      });
    }

    return result;
  }

  public async getTransactionById(transactionId: string) {
    return await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  /**
   * Syncs transaction status with payment gateway.
   */
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

    // Clean Architecture: throw error and let infrastructure layer (worker/controller) handle logging
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
      eventService.emitToUser(transaction.userId, 'TRANSACTION_FAILED', {
        message: 'Payment was canceled by provider.',
      });
      return TransactionStatus.FAILED;
    }

    return TransactionStatus.PENDING;
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
   * Logic for processing a user vote for a specific episode (Video level).
   * Notifies the whole platform about progress and updates user's balance.
   */
  public async processVideoVote(
    userId: number,
    videoId: string,
    amount: number
  ) {
    const updatedVideoResult = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      if (!user || user.balance < amount) {
        throw new Error('Insufficient funds to vote');
      }

      const video = await tx.video.findUnique({
        where: { id: videoId },
        include: { series: true },
      });

      if (!video || video.isReleased) {
        throw new Error('Video is already released or not found');
      }

      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: amount } },
      });

      await tx.vote.create({
        data: { userId, videoId, amount },
      });

      const updatedVideo = await tx.video.update({
        where: { id: videoId },
        data: { collectedFunds: { increment: amount } },
      });

      await tx.series.update({
        where: { id: video.seriesId },
        data: { totalEarnings: { increment: amount } },
      });

      if (updatedVideo.collectedFunds >= updatedVideo.votesRequired) {
        await this.finalizeVideoPool(videoId, tx);
      }

      return updatedVideo;
    });

    // Reactive logic after transaction success
    await this.notifyBalanceUpdate(userId);

    // Broadcast progress to all connected users
    eventService.broadcast('VIDEO_PROGRESS_UPDATED', {
      videoId,
      collectedFunds: updatedVideoResult.collectedFunds,
      votesRequired: updatedVideoResult.votesRequired,
    });

    return updatedVideoResult;
  }

  /**
   * Finalizes the funding for a specific video and distributes the pool.
   */
  private async finalizeVideoPool(videoId: string, tx: any) {
    const video = await tx.video.findUnique({
      where: { id: videoId },
      include: {
        reviews: {
          where: { isExecuted: true },
          include: { critic: true },
        },
      },
    });

    if (!video) return;

    const totalPool = video.collectedFunds;

    let authorRatio = VIDEO_ECONOMY.BASE_SHARES.AUTHOR;
    let platformRatio = VIDEO_ECONOMY.BASE_SHARES.PLATFORM;
    let criticRatio = VIDEO_ECONOMY.BASE_SHARES.CRITICS;

    for (const review of video.reviews) {
      const reputationBonus =
        review.critic.reputation * VIDEO_ECONOMY.CRITIC_REPUTATION_WEIGHT;

      if (review.type === ReviewType.NEGATIVE) {
        authorRatio -= VIDEO_ECONOMY.NEGATIVE_REVIEW_PENALTY.AUTHOR_REDUCTION;
        platformRatio +=
          VIDEO_ECONOMY.NEGATIVE_REVIEW_PENALTY.PLATFORM_GAIN + reputationBonus;
        criticRatio += VIDEO_ECONOMY.NEGATIVE_REVIEW_PENALTY.CRITIC_GAIN;
      } else {
        platformRatio -= VIDEO_ECONOMY.POSITIVE_REVIEW_BOOST.PLATFORM_REDUCTION;
        criticRatio +=
          VIDEO_ECONOMY.POSITIVE_REVIEW_BOOST.CRITIC_GAIN + reputationBonus;
      }
    }

    const authorAmount = Math.floor(totalPool * Math.max(authorRatio, 0));

    // 1. Payout to Author
    await tx.user.update({
      where: { id: video.authorId },
      data: { balance: { increment: authorAmount } },
    });

    await tx.transaction.create({
      data: {
        userId: video.authorId,
        amount: authorAmount,
        type: TransactionType.AUTHOR_PAYOUT,
        status: TransactionStatus.COMPLETED,
        videoId: video.id,
      },
    });

    // 2. Release the video
    await tx.video.update({
      where: { id: videoId },
      data: {
        isReleased: true,
        status: VideoStatus.PUBLISHED,
      },
    });

    // Notify participants in real-time
    await this.notifyBalanceUpdate(video.authorId);
    eventService.emitToUser(video.authorId, 'AUTHOR_PAYOUT_RECEIVED', {
      amount: authorAmount,
      videoTitle: video.title,
    });

    // Global notification that a new video is live
    eventService.broadcast('VIDEO_PUBLISHED', {
      videoId: video.id,
      title: video.title,
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
