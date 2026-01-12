import { Request } from 'express';
import { Role } from '@prisma/client';

export interface UserType {
  id: number;
  email: string;
  name?: string | null;
  password?: string;
  refreshToken?: string | null;
  isAdmin: boolean;
  roles: Role[];
  emailVerified: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  settings: any;
  balance: number;
  reputation: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  userId?: number;
  user?: UserType;
}

export interface AuthResult {
  user: Omit<UserType, 'password' | 'refreshToken'>;
  accessToken: string;
  refreshToken: string;
}
