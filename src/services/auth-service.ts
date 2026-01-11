import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../client';
import { emailService } from './email-service';
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
} from '../utils/auth';
import { RegisterInput, LoginInput } from '../utils';
import { AuthResult } from '../types/auth';

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret_refresh';

export class AuthService {
  public async register(data: RegisterInput): Promise<AuthResult> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      throw new Error('User already exists!');
    }

    const hashed = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        name: data.name,
        isAdmin: false,
      },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60);
    await prisma.emailVerification.create({
      data: { token, userId: user.id, expiresAt: expires },
    });

    // FIXED: Points to the frontend activation route /activate/:link
    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const verifyUrl = `${baseUrl}/activate/${token}`;
    await emailService.sendVerificationEmail(user.email, verifyUrl);

    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        roles: user.roles,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  public async login(data: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      throw new Error('Invalid email or password!');
    }

    const valid = await comparePassword(data.password, user.password);

    if (!valid) {
      throw new Error('Invalid email or password!');
    }

    const accessToken = generateAccessToken({ userId: user.id });
    const refreshToken = generateRefreshToken({ userId: user.id });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        roles: user.roles,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  public async refresh(currentRefreshToken: string): Promise<AuthResult> {
    const payload = jwt.verify(currentRefreshToken, REFRESH_SECRET) as {
      userId: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.refreshToken !== currentRefreshToken) {
      throw new Error('Invalid refresh token');
    }

    const newAccessToken = generateAccessToken({ userId: user.id });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        roles: user.roles,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  public async verifyEmail(token: string): Promise<void> {
    const record = await prisma.emailVerification.findUnique({
      where: { token },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new Error('Expired or invalid token');
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });

    // FIXED: Using deleteMany to prevent "record not found" crashes on duplicate clicks
    await prisma.emailVerification.deleteMany({
      where: { token },
    });
  }

  public async resendVerificationEmail(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60);
    await prisma.emailVerification.create({
      data: { token, userId: user.id, expiresAt: expires },
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
    const verifyUrl = `${baseUrl}/activate/${token}`;

    await emailService.sendVerificationEmail(user.email, verifyUrl);
  }
}

export const authService = new AuthService();
