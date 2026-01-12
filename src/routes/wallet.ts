import { Router } from 'express';
import {
  getBalance,
  depositFunds,
  getTransactionHistory,
  checkDepositStatus,
  yookassaWebhook,
} from '../controllers/wallet-controller';
import { authMiddleware } from '../middleware/auth-middleware';
// import { verifiedMiddleware } from '../middleware/verified-middleware'; // Пока не нужен, но держим в уме

const router = Router();

/**
 * PUBLIC ROUTE (No Auth)
 * YooKassa needs to access this without a JWT token
 */
router.post('/webhook', yookassaWebhook);

/**
 * PROTECTED ROUTES (Require Auth)
 */
router.use(authMiddleware);

router.get('/balance', getBalance);
router.post('/deposit', depositFunds);
router.get('/transactions', getTransactionHistory);
router.get('/status/:transactionId', checkDepositStatus);

/*
router.post(
  '/withdraw', 
  authMiddleware, 
  verifiedMiddleware, // Вот тут он понадобится
  withdrawFunds
);
*/

export default router;
