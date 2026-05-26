import { Request, Response, NextFunction } from 'express';
import ActivityLog from '../models/ActivityLog';

// ─── GET STORE ACTIVITY LOGS ──────────────────────────────────────────────────
export const getActivityLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;

    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find({ sellerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name role');

    const total = await ActivityLog.countDocuments({ sellerId });

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
