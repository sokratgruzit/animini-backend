import { Router } from 'express';
import {
  createSeries,
  createVideo,
  getAuthorWorkspace,
  getUploadUrl,
  getSeriesDetails,
} from '../controllers/video-controller';
import { authMiddleware } from '../middleware/auth-middleware';
import { roleMiddleware } from '../middleware/role-middleware';
import { Role } from '@prisma/client';

const router = Router();

/**
 * 1. Storage: Get secure URL for Supabase upload
 */
router.post(
  '/upload-url',
  authMiddleware,
  roleMiddleware([Role.AUTHOR]),
  getUploadUrl
);

/**
 * 2. Series: Create a new project container
 */
router.post(
  '/series',
  authMiddleware,
  roleMiddleware([Role.AUTHOR]),
  createSeries
);

/**
 * 5. Series Details: Fetch a single series by ID
 * Добавь это ВНИЗУ файла, но выше роутов с динамическими параметрами,
 * если они появятся.
 */
router.get(
  '/series/:id', // Вот этот путь искал фронтенд
  authMiddleware,
  // Тут роль может быть шире, если смотреть серию могут не только авторы
  getSeriesDetails
);

/**
 * 3. Video: Create an episode within a series
 */
router.post('/', authMiddleware, roleMiddleware([Role.AUTHOR]), createVideo);

/**
 * 4. Workspace: Fetch author's series and videos
 */
router.get(
  '/workspace',
  authMiddleware,
  roleMiddleware([Role.AUTHOR]),
  getAuthorWorkspace
);

export default router;
