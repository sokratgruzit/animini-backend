import { Router } from 'express';
import { createVideo, getAuthorVideos } from '../controllers/video-controller';
import { authMiddleware } from '../middleware/auth-middleware';
import { roleMiddleware } from '../middleware/role-middleware';
import { Role } from '@prisma/client';

const router = Router();

// Only authors can create and manage their videos
router.post('/', authMiddleware, roleMiddleware([Role.AUTHOR]), createVideo);

router.get(
  '/my',
  authMiddleware,
  roleMiddleware([Role.AUTHOR]),
  getAuthorVideos
);

export default router;
