import { Router } from 'express';
import {
  createSeries,
  createVideo,
  getAuthorWorkspace,
  getUploadUrl,
  getSeriesDetails,
  getPublicFeed,
} from '../controllers/video-controller';
import { authMiddleware } from '../middleware/auth-middleware';
import { verifiedMiddleware } from '../middleware/verified-middleware';
import { roleMiddleware } from '../middleware/role-middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * 1. Public Feed: Main discover grid with snapshot data
 * Allowed: All authenticated users can view the feed.
 */
router.get('/discover', authMiddleware, getPublicFeed);

/**
 * 2. Storage: Get secure URL for Supabase upload
 * Restricted: No verification — no storage usage.
 */
router.post(
  '/upload-url',
  authMiddleware,
  verifiedMiddleware,
  roleMiddleware([Role.AUTHOR]),
  getUploadUrl
);

/**
 * 3. Series: Create a new project container
 * Restricted: Prevent spamming series without email confirmation.
 */
router.post(
  '/series',
  authMiddleware,
  verifiedMiddleware,
  roleMiddleware([Role.AUTHOR]),
  createSeries
);

/**
 * 4. Video: Create an episode within a series
 * Restricted: Verified authors only.
 */
router.post(
  '/',
  authMiddleware,
  verifiedMiddleware,
  roleMiddleware([Role.AUTHOR]),
  createVideo
);

/**
 * 5. Workspace: Fetch author's series and videos
 * Allowed: Author can see their current work while waiting for verification.
 */
router.get(
  '/workspace',
  authMiddleware,
  roleMiddleware([Role.AUTHOR]),
  getAuthorWorkspace
);

/**
 * 6. Series Details: Fetch a single series by ID
 * Allowed: Public/Author viewing is safe.
 */
router.get('/series/:id', authMiddleware, getSeriesDetails);

export default router;
