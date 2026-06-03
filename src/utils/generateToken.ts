import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// ─── Token Payloads ───────────────────────────────────────────────────────────
export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

// ─── Cookie Options ───────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

export const accessTokenCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
};

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth/refresh', // Scoped to refresh endpoint
};

// ─── Generate Access Token ────────────────────────────────────────────────────
export const generateAccessToken = (
  userId: mongoose.Types.ObjectId | string,
  role: string
): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not defined');

  return jwt.sign(
    { userId: userId.toString(), role } satisfies AccessTokenPayload,
    secret,
    { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any }
  );
};

// ─── Generate Refresh Token ───────────────────────────────────────────────────
export const generateRefreshToken = (
  userId: mongoose.Types.ObjectId | string
): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined');

  return jwt.sign(
    { userId: userId.toString() } satisfies RefreshTokenPayload,
    secret,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any }
  );
};

// ─── Verify Access Token ──────────────────────────────────────────────────────
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not defined');
  return jwt.verify(token, secret) as AccessTokenPayload;
};

// ─── Verify Refresh Token ─────────────────────────────────────────────────────
export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined');
  return jwt.verify(token, secret) as RefreshTokenPayload;
};

// ─── Generate Random Token (for email verification / password reset) ──────────
export const generateRandomToken = (): string => {
  // Using crypto for a secure random token
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.randomBytes(32).toString('hex');
};
