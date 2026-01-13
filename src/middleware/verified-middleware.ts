import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { eventService } from '../services/event-service';

/**
 * Middleware to ensure the user has a verified email address.
 * Notifies the frontend via SSE if verification is missing.
 */
export async function verifiedMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!req.user.emailVerified) {
    /**
     * Trigger SSE event to sync frontend state and show notification.
     * We pass the current user state to ensure Redux is up to date.
     */
    eventService.emitToUser(req.user.id, 'USER_UPDATED', {
      ...req.user,
      emailVerified: false,
    });

    return res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this feature.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  next();
}
