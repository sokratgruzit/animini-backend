import { EXCHANGE_RATE_RUB_PER_COIN } from '../constants';

/**
 * Calculates the fiat amount based on the number of internal coins
 * @param coins - Internal platform currency amount
 * @returns Amount in rubles (fiat)
 */
export const calculateFiatAmount = (coins: number): number => {
  return coins * EXCHANGE_RATE_RUB_PER_COIN;
};
