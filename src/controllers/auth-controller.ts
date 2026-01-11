import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../types/auth';
import { loggerService } from '../services/logger-service';
import { authService } from '../services/auth-service';
import { registerSchema, loginSchema } from '../utils/validation';
import { REFRESH_COOKIE_NAME } from '../constants';

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
  });
};

export const registerUser = async (req: Request, res: Response) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);

    setRefreshCookie(res, result.refreshToken);

    return res.json({
      success: true,
      message: 'You have successfully registered! Check your email.',
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const errorMessages = e.issues.map((issue) => issue.message);

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    if (e instanceof Error && e.message === 'User already exists!') {
      return res.status(409).json({ success: false, message: e.message });
    }

    loggerService.error(
      { e, route: 'registerUser', body: req.body },
      'Error during user registration'
    );

    return res.status(500).json({
      success: false,
      message: 'A server error occurred during registration.',
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);

    setRefreshCookie(res, result.refreshToken);

    return res.json({
      success: true,
      message: 'You have successfully logged in!',
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const errorMessages = e.issues.map((issue) => issue.message);

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    if (e instanceof Error && e.message === 'Invalid email or password!') {
      return res.status(401).json({ success: false, message: e.message });
    }

    loggerService.error(
      { e, route: 'loginUser', body: req.body },
      'Error during user login'
    );

    return res.status(500).json({
      success: false,
      message: 'A server error occurred during login.',
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!currentRefreshToken) {
    return res
      .status(401)
      .json({ success: false, message: 'Refresh token not found in cookie' });
  }

  try {
    const result = await authService.refresh(currentRefreshToken);

    setRefreshCookie(res, result.refreshToken);

    return res.json({
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'Invalid refresh token') {
      return res.status(401).json({ success: false, message: e.message });
    }

    loggerService.error(
      { e, route: 'refreshToken' },
      'Error during refresh token'
    );

    return res
      .status(401)
      .json({ success: false, message: 'Expired or invalid refresh token' });
  }
};

/**
 * FIXED: Now returns JSON instead of redirecting.
 * This satisfies the frontend ActivatePage logic.
 */
export const verifyEmail = async (req: Request, res: Response) => {
  // Use req.body or req.query depending on your frontend activateRequest
  const token = (req.query.token as string) || (req.body.token as string);

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Verification token is missing',
    });
  }

  try {
    await authService.verifyEmail(token);
    return res.json({
      success: true,
      message: 'Email successfully verified',
    });
  } catch (e: any) {
    loggerService.error(
      { e, route: 'verifyEmail' },
      'Error during email verification'
    );

    return res.status(400).json({
      success: false,
      message: e.message || 'Verification failed',
    });
  }
};

export const logoutUser = async (req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  return res
    .status(200)
    .json({ success: true, message: 'Successfully logged out!' });
};

export const resendEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res
        .status(401)
        .json({ success: false, message: 'User not authenticated' });
    }

    await authService.resendVerificationEmail(req.user.id);

    return res.status(200).json({ success: true, message: 'Email sent!' });
  } catch (e) {
    if (e instanceof Error && e.message.includes('User not found')) {
      return res.status(401).json({ success: false, message: e.message });
    }

    loggerService.error(
      { e, route: 'resendEmail' },
      'Error during email sending'
    );

    return res.status(500).json({
      success: false,
      message: 'A server error occurred during email sending.',
    });
  }
};
