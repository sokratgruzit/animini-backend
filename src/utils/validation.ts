import { z } from 'zod';
import { ReviewType } from '@prisma/client';

import { PASSWORD_VALIDATION_REGEX, VIDEO_ECONOMY } from '../constants';

export const registerSchema = z.object({
  email: z.email('Invalid email format'),
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
  email: z.email('Invalid email format'),
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

export const createVideoSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  url: z.url(),
  votesRequired: z
    .number()
    .int()
    .min(1)
    .default(VIDEO_ECONOMY.DEFAULT_VIDEO_THRESHOLD),
});

export const voteVideoSchema = z.object({
  videoId: z.uuid(),
  amount: z.number().int().min(1).default(1),
});

export const createReviewSchema = z.object({
  videoId: z.uuid(),
  content: z.string().min(10).max(2000),
  type: z.enum(ReviewType),
});

export const voteReviewSchema = z.object({
  reviewId: z.uuid(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type VideotInput = z.infer<typeof createVideoSchema>;
export type VoteVideoInput = z.infer<typeof voteVideoSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type VoteReviewInput = z.infer<typeof voteReviewSchema>;
