import { walletService } from '../../services/wallet-service';
import { prisma } from '../../client';
import { TransactionType, TransactionStatus } from '@prisma/client';

jest.mock('../../client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('WalletService Senior Test Suite', () => {
  const userId = 1;
  const transactionId = 'uuid-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Transaction History Pagination', () => {
    it('should calculate correct skip and take values', async () => {
      const page = 2;
      const limit = 20;

      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      await walletService.getTransactions(userId, page, limit);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });
  });

  describe('Atomic Deposit Finalization', () => {
    it('should prevent double-crediting using atomic updateMany', async () => {
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await walletService.completeDeposit(transactionId);

      expect(result).toBeNull();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should credit funds only if status was PENDING', async () => {
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue({
        userId,
        amount: 1000,
      });

      await walletService.completeDeposit(transactionId);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: { increment: 1000 } },
        })
      );
    });
  });

  describe('Abandoned Transactions Cleanup', () => {
    it('should target only pending transactions without externalId', async () => {
      (prisma.transaction.updateMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await walletService.cancelAbandonedTransactions();

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          status: TransactionStatus.PENDING,
          externalId: null,
          createdAt: {
            lt: expect.any(Date),
          },
        },
        data: {
          status: TransactionStatus.FAILED,
        },
      });
    });
  });

  describe('Funds Deduction Logic', () => {
    it('should enforce positive balance during deduction', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ balance: 30 });

      await expect(
        walletService.deductFunds(userId, 50, TransactionType.WITHDRAW)
      ).rejects.toThrow('Insufficient funds');

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
