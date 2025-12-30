import nodemailer from 'nodemailer';

import { loggerService } from './logger-service';

export class EmailService {
  // Приватный метод для создания объекта transporter Nodemailer
  private getTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.NODE_ENV === 'production', // Use secure in production
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Отправляет верификационное письмо пользователю с готовым URL.
   * @param to Email адрес получателя.
   * @param verificationUrl Полный URL для верификации.
   */
  public async sendVerificationEmail(to: string, verificationUrl: string) {
    const message = `Use link to verify email: ${verificationUrl}`;

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: `"Animini" <${process.env.SMTP_USER}>`,
        to: to,
        subject: 'Email verification',
        text: message,
      });
      loggerService.info({ userEmail: to }, `Verification email sent`);
    } catch (error) {
      // Логируем ошибку с помощью сервиса логирования
      loggerService.error(
        { error, userEmail: to },
        'Failed to send verification email'
      );
      // Пробрасываем ошибку выше, чтобы AuthService знал о сбое
      throw new Error('Failed to send verification email');
    }
  }
}

export const emailService = new EmailService();
