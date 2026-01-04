export const REFRESH_COOKIE_NAME = 'refreshToken';

export const PASSWORD_VALIDATION_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]:;"'<>,.?\/\\|`~-]).{8,}$/;

/**
 * Platform's internal exchange rate: RUB per 1 Coin
 */
export const EXCHANGE_RATE_RUB_PER_COIN = 10;

/**
 * Currency code required by the payment provider (YooKassa)
 */
export const PAYMENT_CURRENCY = 'RUB';
