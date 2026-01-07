import { Router } from 'express';
import {
  voteForVideo,
  postReview,
  voteForReview,
} from '../controllers/interaction-controller';
import { authMiddleware } from '../middleware/auth-middleware';
import { roleMiddleware } from '../middleware/role-middleware';
import { Role } from '@prisma/client';

const router = Router();

// Regular users can vote for videos
router.post('/vote-video', authMiddleware, voteForVideo);

// Only critics can post expert reviews
router.post(
  '/review',
  authMiddleware,
  roleMiddleware([Role.CRITIC]),
  postReview
);

// Users vote for reviews to execute them
router.post('/vote-review', authMiddleware, voteForReview);

export default router;
