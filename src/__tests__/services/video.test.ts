import { walletService } from '../../services/wallet-service';
import { prisma } from '../../client';
import { TransactionType, ReviewType } from '@prisma/client';

jest.mock('../../client', () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
    video: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    review: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('Video Economy Logic (WalletService)', () => {
  const userId = 1;
  const videoId = 'video-uuid';
  const authorId = 99;
  const criticId = 55;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('finalizeVideoPool distribution', () => {
    it('should distribute funds correctly with BASE SHARES', async () => {
      const mockVideo = {
        id: videoId,
        authorId,
        collectedFunds: 1000,
        reviews: [],
      };

      (prisma.video.findUnique as jest.Mock).mockResolvedValue(mockVideo);

      await (walletService as any).finalizeVideoPool(videoId, prisma);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: authorId },
          data: { balance: { increment: 700 } },
        })
      );

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: authorId,
            amount: 700,
            type: TransactionType.AUTHOR_PAYOUT,
          }),
        })
      );
    });

    it('should apply penalty for NEGATIVE executed review', async () => {
      const mockVideo = {
        id: videoId,
        authorId,
        collectedFunds: 1000,
        reviews: [
          {
            type: ReviewType.NEGATIVE,
            criticId,
            critic: { id: criticId, reputation: 0 },
          },
        ],
      };

      (prisma.video.findUnique as jest.Mock).mockResolvedValue(mockVideo);

      await (walletService as any).finalizeVideoPool(videoId, prisma);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: authorId },
          data: { balance: { increment: 600 } },
        })
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: criticId },
          data: { balance: { increment: 150 } },
        })
      );
    });
  });

  describe('processReviewVote threshold', () => {
    it('should NOT execute review if threshold is not reached', async () => {
      const reviewId = 'rev-123';
      (prisma.review.findUnique as jest.Mock).mockResolvedValue({
        id: reviewId,
        currentVotes: 10,
        votesRequired: 50,
        isExecuted: false,
      });

      (prisma.review.update as jest.Mock).mockResolvedValue({
        id: reviewId,
        currentVotes: 11,
        votesRequired: 50,
        isExecuted: false,
      });

      const result = await walletService.processReviewVote(userId, reviewId);

      expect(result?.isExecuted).toBe(false);
    });

    it('should execute review when threshold is reached', async () => {
      const reviewId = 'rev-123';
      (prisma.review.findUnique as jest.Mock).mockResolvedValue({
        id: reviewId,
        currentVotes: 49,
        votesRequired: 50,
        isExecuted: false,
      });

      (prisma.review.update as jest.Mock)
        .mockResolvedValueOnce({
          id: reviewId,
          currentVotes: 50,
          votesRequired: 50,
          isExecuted: false,
        })
        .mockResolvedValueOnce({ id: reviewId, isExecuted: true });

      const result = await walletService.processReviewVote(userId, reviewId);

      expect(result?.isExecuted).toBe(true);
    });
  });
});
