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
      return res
        .status(400)
        .json({ success: false, errors: e.issues.map((i) => i.message) });
    }
    if (e instanceof Error && e.message === 'User already exists!') {
      return res.status(409).json({ success: false, message: e.message });
    }
    loggerService.error(
      { e, route: 'registerUser', body: req.body },
      'Error during registration'
    );
    return res.status(500).json({ success: false, message: 'Server error' });
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
      return res
        .status(400)
        .json({ success: false, errors: e.issues.map((i) => i.message) });
    }
    if (e instanceof Error && e.message === 'Invalid email or password!') {
      return res.status(401).json({ success: false, message: e.message });
    }
    loggerService.error({ e, route: 'loginUser' }, 'Error during login');
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!currentRefreshToken) {
    return res.status(401).json({ success: false, message: 'Token not found' });
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
    loggerService.error({ e, route: 'refreshToken' }, 'Error during refresh');
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.body.token as string);
  if (!token)
    return res.status(400).json({ success: false, message: 'Token missing' });

  try {
    await authService.verifyEmail(token);
    return res.json({ success: true, message: 'Email verified' });
  } catch (e: any) {
    loggerService.error(
      { e, route: 'verifyEmail' },
      'Email verification failed'
    );
    return res.status(400).json({ success: false, message: e.message });
  }
};

/**
 * UPDATED: Now calls authService.logout to trigger USER_LOGOUT event
 */
export const logoutUser = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.id) {
      await authService.logout(req.user.id);
    }

    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return res.status(200).json({ success: true, message: 'Logged out!' });
  } catch (e) {
    loggerService.error({ e, route: 'logoutUser' }, 'Logout error');
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * NEW: Update profile controller
 */
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: 'Unauthorized' });

    const result = await authService.updateProfile(req.user.id, req.body);
    return res.json({ success: true, user: result });
  } catch (e: any) {
    loggerService.error(
      { e, route: 'updateProfile', body: req.body },
      'Profile update error'
    );
    return res.status(400).json({ success: false, message: e.message });
  }
};

/**
 * NEW: Change password controller
 */
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: 'Unauthorized' });

    await authService.changePassword(req.user.id, oldPassword, newPassword);

    // After password change, we usually want to clear cookies since sessions are invalidated
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });

    return res.json({
      success: true,
      message: 'Password updated. Please log in again.',
    });
  } catch (e: any) {
    loggerService.error(
      { e, route: 'changePassword' },
      'Password change error'
    );
    return res.status(400).json({ success: false, message: e.message });
  }
};

export const resendEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    await authService.resendVerificationEmail(req.user.id);
    return res.status(200).json({ success: true, message: 'Email sent!' });
  } catch (e: any) {
    loggerService.error({ e, route: 'resendEmail' }, 'Resend email error');
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
