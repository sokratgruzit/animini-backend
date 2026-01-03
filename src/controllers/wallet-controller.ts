import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types/auth';
import { walletService } from '../services/wallet-service';
import { loggerService } from '../services/logger-service';
import { depositSchema } from '../utils/validation';

export const getBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Updated to return both balance and reputation for the frontend slice
    const data = await walletService.getUserBalance(userId);

    return res.json({
      success: true,
      balance: data.balance,
      reputation: data.reputation,
    });
  } catch (e) {
    loggerService.error(
      { e, route: 'getBalance', userId: req.user?.id },
      'Error getting user balance'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve balance',
    });
  }
};

export const depositFunds = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { amount } = depositSchema.parse(req.body);
    const result = await walletService.addFunds(userId, amount);

    return res.json({
      success: true,
      message: 'Funds deposited successfully',
      newBalance: result.balance,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: e.issues.map((issue) => issue.message),
      });
    }

    loggerService.error(
      { e, route: 'depositFunds', body: req.body, userId: req.user?.id },
      'Error depositing funds'
    );

    return res.status(500).json({
      success: false,
      message: 'Failed to deposit funds',
    });
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

    // Handle pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // Fixed: Now requesting paginated data
    const result = await walletService.getTransactions(userId, page, limit);

    // Fixed: Returns object with 'items' as expected by frontend fetchTransactionsRequest
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
