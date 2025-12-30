import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import type { StringValue } from 'ms';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secret_access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret_refresh';

const accessExpiresIn = (process.env.ACCESS_TOKEN_EXPIRES_IN ||
  '15m') as StringValue;
const refreshExpiresIn = (process.env.REFRESH_TOKEN_EXPIRES_IN ||
  '7d') as StringValue;

const accessTokenOptions: SignOptions = {
  expiresIn: accessExpiresIn,
};

const refreshTokenOptions: SignOptions = {
  expiresIn: refreshExpiresIn,
};

export function generateAccessToken(payload: object) {
  return jwt.sign(payload, ACCESS_SECRET, accessTokenOptions);
}

export function generateRefreshToken(payload: object) {
  return jwt.sign(payload, REFRESH_SECRET, refreshTokenOptions);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET);
}

export async function hashPassword(password: string) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
