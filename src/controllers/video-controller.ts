import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types/auth';
import { videoService } from '../services/video-service';
import { storageService } from '../services/storage-service';
import {
  createVideoSchema,
  createSeriesSchema,
  uploadRequestSchema,
  type UploadRequestInput, // Import the inferred type
} from '../utils/validation';

/**
 * AUTHOR action: Request a secure upload URL from storage service
 */
export const getUploadUrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const isAuthor = req.user?.roles.includes('AUTHOR');

    if (!userId || !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Only authors can request upload URLs',
      });
    }

    // Explicitly cast the parsed result to UploadRequestInput to fix TS2339
    const payload = uploadRequestSchema.parse(req.body) as UploadRequestInput;
    const { fileName, seriesId } = payload;

    const { uploadUrl, fileKey } = await storageService.createUploadUrl(
      userId,
      seriesId,
      fileName
    );

    return res.json({
      success: true,
      uploadUrl,
      fileKey,
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: e.issues });
    }
    return res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * AUTHOR action: Create a new Series (Project container)
 */
export const createSeries = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const isAuthor = req.user?.roles.includes('AUTHOR');

    if (!userId || !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'Only authors can create series',
      });
    }

    const validatedData = createSeriesSchema.parse(req.body);
    const series = await videoService.createSeries(userId, validatedData);

    return res.status(201).json({
      success: true,
      series,
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: e.issues });
    }
    return res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * AUTHOR action: Create a video episode within a series
 */
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
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errors: e.issues.map((issue) => issue.message),
      });
    }
    return res
      .status(500)
      .json({ success: false, message: e.message || 'Failed to create video' });
  }
};

/**
 * AUTHOR action: Fetch all series belonging to the author with their videos
 */
export const getAuthorWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const series = await videoService.getSeriesByAuthor(userId);

    return res.json({
      success: true,
      items: series,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || 'Failed to fetch workspace',
    });
  }
};

/**
 * PUBLIC/AUTHOR action: Fetch a single series with its episodes by ID
 */
export const getSeriesDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'Series ID is required' });
    }

    const series = await videoService.getSeriesById(id);

    if (!series) {
      return res
        .status(404)
        .json({ success: false, message: 'Series not found' });
    }

    return res.json({
      success: true,
      data: series,
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      message: e.message || 'Failed to fetch series details',
    });
  }
};
