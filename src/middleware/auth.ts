import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/generateToken';
import User, { IUser } from '../models/User';

// ─── Extend Express Request ───────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// ─── Protect Middleware ───────────────────────────────────────────────────────
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Token comes from httpOnly cookie
    const token = req.cookies?.access_token as string | undefined;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in.',
      });
      return;
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Fetch user from DB (excluding sensitive fields)
    const user = await User.findById(decoded.userId).select(
      '-password -refreshToken -emailVerifyToken -resetPasswordToken'
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
      });
      return;
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

// ─── Restrict To Roles ────────────────────────────────────────────────────────
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }
    next();
  };
};
