import { Router } from 'express';
import {
  createSeries,
  createVideo,
  getAuthorWorkspace,
  getUploadUrl,
  getSeriesDetails,
} from '../controllers/video-controller';
import { authMiddleware } from '../middleware/auth-middleware';
import { verifiedMiddleware } from '../middleware/verified-middleware'; // Added
import { roleMiddleware } from '../middleware/role-middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * 1. Storage: Get secure URL for Supabase upload
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
 * 2. Series: Create a new project container
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
 * 3. Video: Create an episode within a series
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
 * 4. Workspace: Fetch author's series and videos
 * Allowed: Author can see their current work while waiting for verification.
 */
router.get(
  '/workspace',
  authMiddleware,
  roleMiddleware([Role.AUTHOR]),
  getAuthorWorkspace
);

/**
 * 5. Series Details: Fetch a single series by ID
 * Allowed: Public/Author viewing is safe.
 */
router.get('/series/:id', authMiddleware, getSeriesDetails);

export default router;
