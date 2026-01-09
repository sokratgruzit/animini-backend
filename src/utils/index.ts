import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
} from './auth';

import {
  depositSchema,
  createSeriesSchema, // Added
  createVideoSchema,
  createReviewSchema,
  voteReviewSchema,
  voteVideoSchema,
  registerSchema,
  loginSchema,
  uploadRequestSchema, // Added
  RegisterInput,
  LoginInput,
  CreateSeriesInput, // Added
  CreateVideoInput, // Corrected from VideotInput
  VoteReviewInput,
  VoteVideoInput,
  UploadRequestInput, // Added
} from './validation';

import { calculateFiatAmount } from './payment';

export {
  calculateFiatAmount,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
  // Schemas
  registerSchema,
  loginSchema,
  depositSchema,
  createSeriesSchema,
  createVideoSchema,
  createReviewSchema,
  voteReviewSchema,
  voteVideoSchema,
  uploadRequestSchema,
  // Types
  RegisterInput,
  LoginInput,
  CreateSeriesInput,
  CreateVideoInput,
  VoteReviewInput,
  VoteVideoInput,
  UploadRequestInput,
};
