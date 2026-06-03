import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import {
  generateAccessToken,
  generateRefreshToken,
  generateRandomToken,
  verifyRefreshToken,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from '../utils/generateToken';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { AppError } from '../middleware/errorHandler';

// ─── Helper: Set Auth Cookies ─────────────────────────────────────────────────
const sendAuthCookies = (
  res: Response,
  userId: string,
  role: string,
  refreshToken: string
): string => {
  const accessToken = generateAccessToken(userId, role);

  res.cookie('access_token', accessToken, accessTokenCookieOptions);
  res.cookie('refresh_token', refreshToken, refreshTokenCookieOptions);
  return accessToken;
};

// ─── Helper: Clear Auth Cookies ───────────────────────────────────────────────
const clearAuthCookies = (res: Response): void => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('access_token', {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.clearCookie('refresh_token', {
    path: '/api/auth/refresh',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, shopName } = req.body as {
      name: string;
      email: string;
      password: string;
      shopName?: string;
    };

    // Validate required fields
    if (!name || !email || !password) {
      throw new AppError('Name, email, and password are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('An account with this email already exists', 409);
    }

    // Generate verification token
    const emailVerifyToken = generateRandomToken();
    const emailVerifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      shopName: shopName?.trim() || `${name.trim()}'s Store`,
      emailVerifyToken,
      emailVerifyTokenExpires,
    });

    // Send verification email (non-blocking)
    sendVerificationEmail(user.email, user.name, emailVerifyToken).catch(console.error);

    res.status(201).json({
      success: true,
      message:
        'Registration successful! Please check your email to verify your account.',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        shopName: user.shopName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isEmailVerified) {
      throw new AppError('Please verify your email', 403);
    }

    // Generate refresh token
    const refreshToken = generateRefreshToken(user._id);

    // Persist refresh token hash to DB
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Set cookies
    const accessToken = sendAuthCookies(res, user._id.toString(), user.role, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: accessToken,
      refreshToken: refreshToken,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        shopName: user.shopName,
        shopLogo: user.shopLogo,
        role: user.role,
        sellerId: user.sellerId,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── VERIFY EMAIL ─────────────────────────────────────────────────────────────
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.query as { token: string };

    if (!token) {
      throw new AppError('Verification token is required', 400);
    }

    const user = await User.findOne({
      emailVerifyToken: token,
      emailVerifyTokenExpires: { $gt: new Date() },
    }).select('+emailVerifyToken +emailVerifyTokenExpires');

    if (!user) {
      throw new AppError(
        'Invalid or expired verification token. Please request a new one.',
        400
      );
    }

    // Mark as verified
    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (error) {
    next(error);
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as { email: string };

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always respond with same message (security: don't reveal if email exists)
    const successMessage =
      "If an account with that email exists, you'll receive a password reset link shortly.";

    if (!user) {
      res.status(200).json({ success: true, message: successMessage });
      return;
    }

    // Generate reset token
    const resetToken = generateRandomToken();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    // Send email with RAW token (not hash)
    sendPasswordResetEmail(user.email, user.name, resetToken).catch(console.error);

    res.status(200).json({ success: true, message: successMessage });
  } catch (error) {
    next(error);
  }
};

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.query as { token: string };
    const { password, confirmPassword } = req.body as {
      password: string;
      confirmPassword: string;
    };

    if (!token) {
      throw new AppError('Reset token is required', 400);
    }

    if (!password || !confirmPassword) {
      throw new AppError('Password and confirm password are required', 400);
    }

    if (password !== confirmPassword) {
      throw new AppError('Passwords do not match', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // Hash the incoming token and compare
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      throw new AppError('Invalid or expired reset token. Please request a new one.', 400);
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshToken = undefined; // Invalidate all sessions
    await user.save();

    // Clear cookies
    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: 'Password reset successful! Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.refresh_token as string | undefined;
    if (!token && req.body?.refreshToken) {
      token = req.body.refreshToken;
    }

    if (!token) {
      throw new AppError('No refresh token provided', 401);
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(token);

    // Find user with matching refresh token
    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      clearAuthCookies(res);
      throw new AppError('Invalid refresh token. Please log in again.', 401);
    }

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken(user._id);
    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    // Set new cookies
    const accessToken = sendAuthCookies(res, user._id.toString(), user.role, newRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed',
      token: accessToken,
      refreshToken: newRefreshToken,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        shopName: user.shopName,
        shopLogo: user.shopLogo,
        role: user.role,
        sellerId: user.sellerId,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.refresh_token as string | undefined;

    if (token) {
      // Invalidate refresh token in DB
      await User.findOneAndUpdate(
        { refreshToken: token },
        { refreshToken: null },
        { validateBeforeSave: false }
      );
    }

    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

// ─── RESEND VERIFICATION EMAIL ────────────────────────────────────────────────
export const resendVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as { email: string };

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+emailVerifyToken +emailVerifyTokenExpires'
    );

    if (!user) {
      res
        .status(200)
        .json({ success: true, message: 'If that email exists, a new verification link has been sent.' });
      return;
    }

    if (user.isEmailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    const emailVerifyToken = generateRandomToken();
    user.emailVerifyToken = emailVerifyToken;
    user.emailVerifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    sendVerificationEmail(user.email, user.name, emailVerifyToken).catch(console.error);

    res
      .status(200)
      .json({ success: true, message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE CURRENT USER PROFILE / STORE DETAILS ──────────────────────────────
export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, shopName, shopLogo } = req.body as {
      name?: string;
      email?: string;
      shopName?: string;
      shopLogo?: string;
    };

    const user = await User.findById(req.user!._id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Update Profile Info
    if (name) user.name = name.trim();
    if (email) {
      const emailLower = email.toLowerCase().trim();
      if (emailLower !== user.email) {
        // Check if email already taken
        const emailTaken = await User.findOne({ email: emailLower });
        if (emailTaken) {
          throw new AppError('An account with this email already exists', 409);
        }
        user.email = emailLower;
      }
    }

    // Update Store Details (Owners only)
    if (shopName || shopLogo !== undefined) {
      if (user.role !== 'owner' && user.role !== 'seller') {
        throw new AppError('Only the store owner can modify store details', 403);
      }
      if (shopName) {
        user.shopName = shopName.trim();
      }
      if (shopLogo !== undefined) {
        user.shopLogo = shopLogo;
      }

      // Update for all team members under this owner
      await User.updateMany(
        { sellerId: user._id },
        { 
          $set: { 
            ...(shopName ? { shopName: shopName.trim() } : {}),
            ...(shopLogo !== undefined ? { shopLogo } : {})
          } 
        }
      );
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
