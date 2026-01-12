import { Router } from 'express';
import {
  voteForVideo,
  postReview,
  voteForReview,
} from '../controllers/interaction-controller';
import { authMiddleware } from '../middleware/auth-middleware';
import { verifiedMiddleware } from '../middleware/verified-middleware'; // Added
import { roleMiddleware } from '../middleware/role-middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * Regular users can vote for videos.
 * Requires verified email to prevent Sybil attacks on funding.
 */
router.post('/vote-video', authMiddleware, verifiedMiddleware, voteForVideo);

/**
 * Only critics can post expert reviews.
 * Requires verified email to ensure critic accountability.
 */
router.post(
  '/review',
  authMiddleware,
  verifiedMiddleware,
  roleMiddleware([Role.CRITIC]),
  postReview
);

/**
 * Users vote for reviews to execute them.
 * Requires verified email to prevent manipulation of review outcomes.
 */
router.post('/vote-review', authMiddleware, verifiedMiddleware, voteForReview);

export default router;
