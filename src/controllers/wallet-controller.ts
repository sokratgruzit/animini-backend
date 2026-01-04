import { Response, Request } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { AuthRequest } from '../types/auth';
import { walletService } from '../services/wallet-service';
import { loggerService } from '../services/logger-service';
import { depositSchema } from '../utils/validation';

export const getBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: 'Unauthorized' });

    const data = await walletService.getUserBalance(userId);
    return res.json({
      success: true,
      balance: data.balance,
      reputation: data.reputation,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve balance' });
  }
};

/**
 * Initiates a deposit via YooKassa.
 * Creates a PENDING transaction and returns a confirmation URL.
 */
export const depositFunds = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { amount } = depositSchema.parse(req.body);
    const { paymentData, transactionId } =
      await walletService.createDepositOrder(userId, amount);

    const idempotenceKey = crypto.randomUUID();
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' +
          Buffer.from(
            `${process.env.YCASSA_SHOP_ID}:${process.env.YCASSA_SECRET_KEY}`
          ).toString('base64'),
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify(paymentData),
    });

    const data: any = await response.json();

    if (data.confirmation?.confirmation_url) {
      // Step 2: Use the service to save the YooKassa ID (data.id)
      await walletService.updateExternalId(transactionId, data.id);

      return res.json({
        success: true,
        confirmationUrl: data.confirmation.confirmation_url,
        transactionId,
      });
    }

    return res.status(400).json({
      success: false,
      message: data.message || 'Failed to create payment session',
    });
  } catch (e) {
    console.log('FULL ERROR:', e);
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: e.issues.map((issue) => issue.message),
      });
    }

    loggerService.error(
      { e, route: 'depositFunds', body: req.body, userId: req.user?.id },
      'Error initiating deposit'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to initiate deposit',
    });
  }
};

/**
 * Checks the status of a specific YooKassa payment.
 * If succeeded, finalizes the transaction in the DB.
 */
export const checkDepositStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { transactionId } = req.params;

    if (!userId)
      return res.status(401).json({ success: false, message: 'Unauthorized' });

    // Step 3a: Use service to get the transaction and its external ID
    const transaction = await walletService.getTransactionById(transactionId);

    if (!transaction?.externalId) {
      return res
        .status(404)
        .json({ success: false, message: 'External payment ID not found' });
    }

    // Step 3b: Use the externalId to ask YooKassa for status
    const response = await fetch(
      `https://api.yookassa.ru/v3/payments/${transaction.externalId}`,
      {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.YCASSA_SHOP_ID}:${process.env.YCASSA_SECRET_KEY}`
            ).toString('base64'),
        },
      }
    );

    const data: any = await response.json();

    if (data.status === 'succeeded') {
      const updatedUser = await walletService.completeDeposit(transactionId);
      return res.json({
        success: true,
        status: 'completed',
        newBalance: updatedUser?.balance,
      });
    }

    return res.json({
      success: true,
      status: data.status,
    });
  } catch (e) {
    loggerService.error(
      { e, route: 'checkDepositStatus', userId: req.user?.id },
      'Error checking payment status'
    );
    return res
      .status(500)
      .json({ success: false, message: 'Internal server error' });
  }
};

export const getTransactionHistory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await walletService.getTransactions(userId, page, limit);

    return res.json({
      success: true,
      items: result.items,
      total: result.total,
    });
  } catch (e) {
    loggerService.error(
      { e, route: 'getTransactionHistory', userId: req.user?.id },
      'Error getting transaction history'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve transactions',
    });
  }
};

/**
 * Asynchronous webhook handler for YooKassa events
 */
export const yookassaWebhook = async (req: Request, res: Response) => {
  try {
    const event = req.body;
    if (!event || typeof event !== 'object')
      return res.status(200).json({ success: true });

    if (event.event === 'payment.succeeded') {
      const transactionId = event.object?.metadata?.transactionId;

      if (transactionId) {
        await walletService.completeDeposit(transactionId);
        loggerService.info(
          { transactionId, paymentId: event.object.id },
          'Deposit finalized via Webhook'
        );
      }
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    loggerService.error({ e }, 'Webhook processing failed');
    return res.status(200).json({ success: false });
  }
};
