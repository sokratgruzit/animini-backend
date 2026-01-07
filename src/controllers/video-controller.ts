import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types/auth';
import { videoService } from '../services/video-service';
import { createVideoSchema } from '../utils/validation';

export const createVideo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const isAuthor = req.user?.roles.includes('AUTHOR');

    if (!userId || !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Only authors can upload videos',
      });
    }

    const validatedData = createVideoSchema.parse(req.body);
    const video = await videoService.createVideo(userId, validatedData);

    return res.status(201).json({
      success: true,
      video,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: e.issues.map((issue) => issue.message),
      });
    }
    return res
      .status(500)
      .json({ success: false, message: 'Failed to create video' });
  }
};

export const getAuthorVideos = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const videos = await videoService.getVideosByAuthor(userId);

    return res.json({
      success: true,
      items: videos,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch videos' });
  }
};
