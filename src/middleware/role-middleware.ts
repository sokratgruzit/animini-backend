import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { Role } from '@prisma/client'; // Import the Enum type

/**
 * Middleware to restrict access based on user roles.
 */
export const roleMiddleware = (allowedRoles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // req.user.roles is already Role[] thanks to Prisma
    const userRoles = req.user?.roles || [];

    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions',
      });
    }

    next();
  };
};
