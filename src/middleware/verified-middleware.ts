import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';

/**
 * Middleware to ensure the user has a verified email address.
 * Must be used AFTER authMiddleware.
 */
export async function verifiedMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // If user is not even logged in (though authMiddleware should catch this)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // The critical check: emailVerified must be true
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Please verify your email address to access this feature.',
      code: 'EMAIL_NOT_VERIFIED', // Handy for frontend to show specific modals
    });
  }

  next();
}
