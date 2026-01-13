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

export const VIDEO_ECONOMY = {
  BASE_SHARES: {
    AUTHOR: 0.7,
    PLATFORM: 0.2,
    CRITICS: 0.1,
  },
  NEGATIVE_REVIEW_PENALTY: {
    AUTHOR_REDUCTION: 0.1,
    PLATFORM_GAIN: 0.05,
    CRITIC_GAIN: 0.05,
  },
  POSITIVE_REVIEW_BOOST: {
    PLATFORM_REDUCTION: 0.05,
    CRITIC_GAIN: 0.05,
  },
  CRITIC_REPUTATION_WEIGHT: 0.001,
  /**
   * The number of coins required to release a single video episode.
   */
  DEFAULT_VIDEO_THRESHOLD: 1000,
  /**
   * Initial amount of collected funds for new series and videos.
   */
  INITIAL_FUNDS: 0,
  DEFAULT_REVIEW_THRESHOLD: 50,
  CREATION_FEE: 500,
};
