import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types/auth';
import { authService } from '../services/auth-service';
import { REFRESH_COOKIE_NAME } from '../constants';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secret_access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret_refresh';

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.split(' ')[1];
  const refreshCookie = req.cookies?.[REFRESH_COOKIE_NAME];

  let userId: number | null = null;

  try {
    /**
     * 1. Standard Authorization Header Strategy
     */
    if (bearerToken) {
      const payload = jwt.verify(bearerToken, ACCESS_SECRET) as {
        userId: number;
      };
      userId = payload.userId;
    } else if (refreshCookie) {
      /**
       * 2. SSE Fallback Strategy: Use Refresh Cookie
       * EventSource API does not support custom headers but sends cookies.
       */
      const payload = jwt.verify(refreshCookie, REFRESH_SECRET) as {
        userId: number;
      };
      userId = payload.userId;
    }

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    /**
     * 3. Clean Architecture: Delegate DB fetching to the Service Layer.
     * Middleware remains infrastructure-agnostic.
     */
    const user = await authService.validateUserSession(userId);

    if (!user) {
      return res
        .status(401)
        .json({ message: 'User session invalid or expired' });
    }

    req.userId = user.id;
    req.user = user as any;

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired credentials' });
  }
}
