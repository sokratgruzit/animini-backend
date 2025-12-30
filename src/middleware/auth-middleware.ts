import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../client';
import { AuthRequest } from '../types/auth';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secret_access';

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: 'Token not presented' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token is undefined' });

  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as { userId: number };
    if (!payload.userId) throw new Error('Invalid token');

    req.userId = payload.userId;

    // Загружаем пользователя из базы
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        password: false,
        emailVerified: true,
        isAdmin: true,
        roles: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return res.status(401).json({ message: 'Token not found' });

    req.user = user;

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
