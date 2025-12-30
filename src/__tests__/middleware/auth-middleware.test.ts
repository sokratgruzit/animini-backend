import { authMiddleware } from '../../middleware/auth-middleware';
import { prisma } from '../../client';
import jwt from 'jsonwebtoken';

// Мокаем prisma и jwt
jest.mock('../../client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Auth Middleware', () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    // Подготовка чистых моков перед каждым тестом
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if no authorization header is present', async () => {
    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Token not presented',
    });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it('should return 401 if token is missing in Bearer format', async () => {
    mockRequest.headers.authorization = 'Bearer '; // Пустой токен после пробела

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Token is undefined',
    });
  });

  it('should return 401 if token is invalid or expired', async () => {
    mockRequest.headers.authorization = 'Bearer invalid_token';

    // Имитируем ошибку при проверке JWT
    jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Invalid or expired token',
    });
  });

  it('should return 401 if user is not found in database', async () => {
    mockRequest.headers.authorization = 'Bearer valid_token';

    jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 1 } as any);
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      message: 'Token not found',
    });
  });

  it('should call next() and populate req.user if token and user are valid', async () => {
    mockRequest.headers.authorization = 'Bearer valid_token';

    const mockUser = {
      id: 1,
      email: 'test@test.com',
      isAdmin: false,
      roles: ['USER'],
    };

    jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 1 } as any);
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

    await authMiddleware(mockRequest, mockResponse, nextFunction);

    expect(mockRequest.userId).toBe(1);
    expect(mockRequest.user).toEqual(mockUser);
    expect(nextFunction).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });
});
