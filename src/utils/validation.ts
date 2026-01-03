import { z } from 'zod';

import { PASSWORD_VALIDATION_REGEX } from '../constants';

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
