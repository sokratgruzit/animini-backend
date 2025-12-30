import { AuthService } from '../../services/auth-service';
import { prisma } from '../../client';
import { emailService } from '../../services/email-service';

// --- Мокирование зависимостей на уровне модуля ---

jest.mock('../../client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailVerification: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../services/email-service', () => ({
  emailService: {
    sendVerificationEmail: jest.fn(),
  },
}));

const authService = new AuthService();

describe('Auth Service (Registration)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error if the user already exists during registration', async () => {
    // Используем any для мок-объекта, чтобы обойти проблемы с типизацией
    const mockUser: any = {
      id: 1,
      email: 'existing@example.com',
      name: 'Existing User',
      roles: ['USER'],
      password: 'hashedpassword',
      refreshToken: null,
      emailVerified: true,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Настраиваем мок findUnique вернуть наш мок-объект
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

    const registrationData = {
      email: 'existing@example.com',
      password: 'StrongP@ss123',
      name: 'Existing User',
    };

    await expect(authService.register(registrationData)).rejects.toThrow(
      'User already exists!'
    );

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('should successfully register a new user', async () => {
    // 1. Настраиваем моки: пользователя нет в базе
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    // Мокаем создание пользователя
    const mockCreatedUser: any = {
      id: 2,
      email: 'new@example.com',
      name: 'New User',
      password: 'hashedpassword',
      isAdmin: false,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.user.create as jest.Mock).mockResolvedValueOnce(mockCreatedUser);

    // Мокаем создание записи верификации и обновление пользователя (токены)
    (prisma.emailVerification.create as jest.Mock).mockResolvedValueOnce({});
    (prisma.user.update as jest.Mock).mockResolvedValueOnce(mockCreatedUser);

    // 2. Данные для регистрации
    const registrationData = {
      email: 'new@example.com',
      password: 'StrongP@ss123!',
      name: 'New User',
    };

    // 3. Вызываем метод
    const result = await authService.register(registrationData);

    // 4. Проверки (Assertions)
    expect(result).toHaveProperty('accessToken');
    expect(result.user.email).toBe('new@example.com');

    // Проверяем, что методы базы данных вызывались
    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.emailVerification.create).toHaveBeenCalled();

    // Проверяем, что была попытка отправить письмо
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      'new@example.com',
      expect.stringContaining('token=')
    );
  });
});

describe('Auth Service (Login)', () => {
  it('should throw an error if the user is not found during login', async () => {
    // Настраиваем мок: пользователя нет в базе
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const loginData = {
      email: 'nonexistent@example.com',
      password: 'StrongP@ss123!',
    };

    await expect(authService.login(loginData)).rejects.toThrow(
      'Invalid email or password!'
    );

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if the password is incorrect', async () => {
    // Имитируем, что пользователь найден
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 1,
      email: 'test@example.com',
      password: 'hashedpassword_in_db',
      name: 'Test User',
      isAdmin: false,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Здесь фокус: так как мы используем реальный bcrypt в утилитах,
    // 'comparePassword' вернет false, так как 'wrong_password' не совпадет с 'hashedpassword_in_db'
    const loginData = {
      email: 'test@example.com',
      password: 'wrong_password',
    };

    await expect(authService.login(loginData)).rejects.toThrow(
      'Invalid email or password!'
    );
  });

  it('should successfully login and return tokens', async () => {
    // Нам нужен реальный хеш, чтобы comparePassword сработал в тесте
    // (или мы могли бы мокнуть utils, но проще использовать валидный хеш)
    const { hashPassword } = require('../../utils/auth');
    const validPassword = 'StrongP@ss123!';
    const validHash = await hashPassword(validPassword);

    const mockUser: any = {
      id: 1,
      email: 'test@example.com',
      password: validHash,
      roles: ['USER'],
      name: 'Test User',
      isAdmin: false,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValueOnce(mockUser);

    const loginData = {
      email: 'test@example.com',
      password: validPassword,
    };

    const result = await authService.login(loginData);

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user.email).toBe('test@example.com');
    expect(prisma.user.update).toHaveBeenCalled(); // Проверяем, что обновили refreshToken в БД
  });
});

describe('Auth Service (Other methods)', () => {
  it('should successfully refresh tokens', async () => {
    const jwt = require('jsonwebtoken');
    const mockPayload = { userId: 1 };
    const mockUser: any = {
      id: 1,
      roles: ['USER'],
      email: 'test@test.com',
      refreshToken: 'old_refresh_token',
    };

    // Мокаем jwt.verify, чтобы он вернул наш payload
    jest.spyOn(jwt, 'verify').mockReturnValue(mockPayload as any);

    // Настраиваем поведение базы данных
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValueOnce(mockUser);

    const result = await authService.refresh('old_refresh_token');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('should throw error if refresh token is invalid or user mismatch', async () => {
    const jwt = require('jsonwebtoken');
    jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 1 } as any);

    // Имитируем, что в базе у пользователя другой токен
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 1,
      refreshToken: 'different_token_in_db',
    });

    await expect(authService.refresh('sent_token')).rejects.toThrow(
      'Invalid refresh token'
    );
  });

  it('should successfully verify email', async () => {
    const mockRecord = {
      userId: 1,
      expiresAt: new Date(Date.now() + 10000), // еще не просрочен
    };

    (prisma.emailVerification.findUnique as jest.Mock).mockResolvedValueOnce(
      mockRecord
    );
    (prisma.user.update as jest.Mock).mockResolvedValueOnce({});
    (prisma.emailVerification.delete as jest.Mock).mockResolvedValueOnce({});

    await expect(authService.verifyEmail('valid_token')).resolves.not.toThrow();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { emailVerified: true },
    });
    expect(prisma.emailVerification.delete).toHaveBeenCalled();
  });

  it('should throw error if verification token is expired', async () => {
    const mockRecord = {
      userId: 1,
      expiresAt: new Date(Date.now() - 10000), // уже просрочен
    };

    (prisma.emailVerification.findUnique as jest.Mock).mockResolvedValueOnce(
      mockRecord
    );

    await expect(authService.verifyEmail('expired_token')).rejects.toThrow(
      'Expired or invalid token'
    );
  });

  it('should resend verification email successfully', async () => {
    const mockUser: any = { id: 1, roles: ['USER'], email: 'test@test.com' };
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);
    (prisma.emailVerification.create as jest.Mock).mockResolvedValueOnce({});

    await authService.resendVerificationEmail(1);

    expect(prisma.emailVerification.create).toHaveBeenCalled();
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      'test@test.com',
      expect.stringContaining('token=')
    );
  });
});
