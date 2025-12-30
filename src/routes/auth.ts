import { Router } from 'express';
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  verifyEmail,
  resendEmail,
} from '../controllers/auth-controller';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshToken);
router.get('/logout', logoutUser);
router.get('/verify-email', verifyEmail);
router.get('/resend-email', authMiddleware, resendEmail);

export default router;
