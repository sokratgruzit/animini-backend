import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../client';
import { emailService } from './email-service';
import { eventService } from './event-service';
import {
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  comparePassword,
} from '../utils/auth';
import { RegisterInput, LoginInput } from '../utils';
import { AuthResult, UserType } from '../types/auth';

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret_refresh';

export class AuthService {
  /**
   * Infrastructure Gateway: Validates if user exists and returns full profile.
   * This removes direct Prisma dependency from middleware.
   */
  public async validateUserSession(
    userId: number
  ): Promise<Omit<UserType, 'password' | 'refreshToken'> | null> {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        isAdmin: true,
        roles: true,
        avatarUrl: true,
        bio: true,
        settings: true,
        balance: true,
        reputation: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

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
        avatarUrl: null,
        bio: null,
        settings: {},
        balance: 0,
        reputation: 0,
      },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60);
    await prisma.emailVerification.create({
      data: { token, userId: user.id, expiresAt: expires },
    });

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
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        settings: user.settings as Record<string, any>,
        balance: user.balance,
        reputation: user.reputation,
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

    eventService.emitToUser(user.id, 'USER_LOGIN', { userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isAdmin: user.isAdmin,
        roles: user.roles,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        settings: user.settings as Record<string, any>,
        balance: user.balance,
        reputation: user.reputation,
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
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        settings: user.settings as Record<string, any>,
        balance: user.balance,
        reputation: user.reputation,
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

    const updatedUser = await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });

    await prisma.emailVerification.deleteMany({
      where: { token },
    });

    eventService.emitToUser(updatedUser.id, 'USER_UPDATED', {
      emailVerified: true,
    });
  }

  public async updateProfile(
    userId: number,
    updateData: Record<string, any>
  ): Promise<any> {
    const allowedFields = ['name', 'avatarUrl', 'bio', 'settings'];

    const safeData = Object.keys(updateData)
      .filter((key) => allowedFields.includes(key))
      .reduce(
        (obj, key) => {
          obj[key] = updateData[key];
          return obj;
        },
        {} as Record<string, any>
      );

    if (Object.keys(safeData).length === 0) {
      throw new Error('No valid fields provided');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: safeData,
    });

    eventService.emitToUser(userId, 'USER_UPDATED', safeData);

    return updated;
  }

  public async changePassword(
    userId: number,
    oldPass: string,
    newPass: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const valid = await comparePassword(oldPass, user.password);
    if (!valid) throw new Error('Invalid current password');

    const hashed = await hashPassword(newPass);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, refreshToken: null },
    });

    eventService.emitToUser(userId, 'PASSWORD_CHANGED', {
      timestamp: new Date(),
    });
    eventService.emitToUser(userId, 'USER_LOGOUT', {
      reason: 'Password updated',
    });
  }

  public async logout(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    eventService.emitToUser(userId, 'USER_LOGOUT', { message: 'Logged out' });
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
