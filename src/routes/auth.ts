import { Router } from 'express';
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  verifyEmail,
  resendEmail,
  updateProfile,
  changePassword,
} from '../controllers/auth-controller';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshToken);
router.post('/verify-email', verifyEmail);

router.use(authMiddleware); // All routes below this line will use authMiddleware

router.post('/logout', logoutUser);
router.post('/resend-email', resendEmail);
router.patch('/profile', updateProfile);
router.post('/change-password', changePassword);

export default router;
