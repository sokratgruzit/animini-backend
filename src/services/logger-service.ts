import pino, { Logger, Level } from 'pino';

export class LoggerService {
  private logger: Logger;

  constructor() {
    const level: Level =
      process.env.NODE_ENV === 'production' ? 'info' : 'debug';

    this.logger = pino({
      level: level,
      timestamp: pino.stdTimeFunctions.isoTime,
      // Если вы используете pino-pretty для красивого вывода в dev режиме,
      // вам может понадобиться дополнительная конфигурация тут
    });
  }

  // Предоставляем методы для логирования разных уровней
  public debug(obj: object | string, msg?: string) {
    this.logger.debug(obj, msg);
  }

  public info(obj: object | string, msg?: string) {
    this.logger.info(obj, msg);
  }

  public error(obj: object | string, msg?: string) {
    this.logger.error(obj, msg);
  }

  // ... можно добавить warn, fatal и trace по необходимости
}

export const loggerService = new LoggerService();
