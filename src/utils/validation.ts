import { z } from 'zod';
import { ReviewType } from '@prisma/client';

import { PASSWORD_VALIDATION_REGEX, VIDEO_ECONOMY } from '../constants';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      PASSWORD_VALIDATION_REGEX,
      'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character'
    ),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(
      PASSWORD_VALIDATION_REGEX,
      'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character'
    ),
});

export const depositSchema = z.object({
  amount: z.number().int().positive('Amount must be a positive integer'),
});

/**
 * Schema for creating a new Series (2026 Economy Model)
 * Updated to support Tags for AI2UI categorization.
 */
export const createSeriesSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  coverUrl: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url().optional()
  ),
  /**
   * Added tags for classification.
   * Ensures input is an array of strings.
   */
  tags: z.array(z.string()).default([]),
});

/**
 * Updated Video schema: now acts as an episode within a Series
 */
export const createVideoSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  url: z.string().url(),
  seriesId: z.string().uuid('Invalid series ID reference'),
});

export const voteVideoSchema = z.object({
  videoId: z.string().uuid(),
  amount: z.number().int().min(1).default(1),
});

export const createReviewSchema = z.object({
  videoId: z.string().uuid(),
  content: z.string().min(10).max(2000),
  type: z.nativeEnum(ReviewType),
});

export const voteReviewSchema = z.object({
  reviewId: z.string().uuid(),
});

/**
 * FIXED: Explicitly using z.uuid() for seriesId
 */
export const uploadRequestSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string(),
  seriesId: z.string().uuid('Invalid series ID reference'),
});

/**
 * Validation schema for the public feed query parameters
 */
export const publicFeedSchema = z.object({
  cursor: z.string().optional(),
  limit: z.preprocess(
    (val) => Number(val),
    z.number().int().positive().default(10)
  ),
  tags: z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',') : val),
    z.array(z.string()).optional()
  ),
  type: z.enum(['hot', 'new', 'completed', 'most_funded']).default('new'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type VoteVideoInput = z.infer<typeof voteVideoSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type VoteReviewInput = z.infer<typeof voteReviewSchema>;
export type UploadRequestInput = z.infer<typeof uploadRequestSchema>;
export type PublicFeed = z.infer<typeof publicFeedSchema>;
