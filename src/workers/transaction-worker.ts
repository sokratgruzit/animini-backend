// workers/transaction-worker.ts

import cron from 'node-cron';
import { walletService } from '../services/wallet-service';
import { loggerService } from '../services/logger-service';

export const initTransactionWorker = () => {
  cron.schedule('*/10 * * * *', async () => {
    loggerService.info('Starting wallet maintenance tasks...');

    try {
      // Task A: Sync existing payments with YooKassa
      const pendingTransactions =
        await walletService.getStalePendingTransactions(50);
      for (const tx of pendingTransactions) {
        await walletService.syncTransactionStatus(tx.id);
      }

      // Task B: Cancel abandoned records (no externalId)
      const result = await walletService.cancelAbandonedTransactions();
      if (result.count > 0) {
        loggerService.info(
          { count: result.count },
          'Cleaned up abandoned transactions'
        );
      }
    } catch (criticalError) {
      loggerService.error(
        { criticalError },
        'Critical error in Transaction Worker'
      );
    }
  });
};
