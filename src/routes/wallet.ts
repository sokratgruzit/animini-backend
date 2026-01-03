import { Router } from 'express';
import {
  getBalance,
  depositFunds,
  getTransactionHistory,
} from '../controllers/wallet-controller';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

router.use(authMiddleware);

router.get('/balance', getBalance);
router.post('/deposit', depositFunds);
router.get('/transactions', getTransactionHistory);

export default router;
