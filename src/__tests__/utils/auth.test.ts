import { hashPassword, comparePassword } from '../../utils/auth';

describe('Auth Utilities', () => {
  // Тест 1: Проверяем, что пароль корректно хэшируется
  it('should hash a password correctly', async () => {
    const password = 'TestPassword123@';
    const hashedPassword = await hashPassword(password);

    // Ожидаем, что хэш не является пустым и отличается от исходного пароля
    expect(hashedPassword).toBeDefined();
    expect(hashedPassword).not.toBe(password);
    expect(typeof hashedPassword).toBe('string');
  });

  // Тест 2: Проверяем сравнение паролей
  it('should compare a plain password with a hash correctly', async () => {
    const password = 'AnotherSecretPassword@';
    const hashedPassword = await hashPassword(password);

    // Ожидаем, что сравнение вернет true для верного пароля
    const isMatch = await comparePassword(password, hashedPassword);
    expect(isMatch).toBe(true);

    // Ожидаем, что сравнение вернет false для неверного пароля
    const isWrongMatch = await comparePassword('WrongPassword', hashedPassword);
    expect(isWrongMatch).toBe(false);
  });
});
