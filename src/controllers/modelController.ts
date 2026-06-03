import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ModelImage from '../models/ModelImage';
import ModelGroup from '../models/ModelGroup';
import ActivityLog from '../models/ActivityLog';
import { AppError } from '../middleware/errorHandler';

// ─── Helper: Log Image Activity ──────────────────────────────────────────────
const logModelImageActivity = async (
  sellerId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  userName: string,
  action: 'model_image_uploaded' | 'model_image_deleted',
  modelImage: any
) => {
  try {
    await ActivityLog.create({
      sellerId,
      user: userId,
      userName,
      action,
      details: {
        modelImageId: modelImage._id,
        modelImageTitle: modelImage.title,
      },
    });
  } catch (err) {
    console.error('⚠️ Failed to log model image activity event:', err);
  }
};

// ─── Helper: Log Group Activity ──────────────────────────────────────────────
const logModelGroupActivity = async (
  sellerId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  userName: string,
  action: 'model_group_created' | 'model_group_deleted',
  modelGroup: any
) => {
  try {
    await ActivityLog.create({
      sellerId,
      user: userId,
      userName,
      action,
      details: {
        modelGroupId: modelGroup._id,
        modelGroupTitle: modelGroup.title,
      },
    });
  } catch (err) {
    console.error('⚠️ Failed to log model group activity event:', err);
  }
};

// ─── Helper: Log Image Assignment Activity ───────────────────────────────────
const logModelImageAssignActivity = async (
  sellerId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  userName: string,
  modelImage: any,
  modelGroup?: any
) => {
  try {
    await ActivityLog.create({
      sellerId,
      user: userId,
      userName,
      action: 'model_image_assigned_group',
      details: {
        modelImageId: modelImage._id,
        modelImageTitle: modelImage.title,
        modelGroupId: modelGroup ? modelGroup._id : null,
        modelGroupTitle: modelGroup ? modelGroup.title : 'Ungrouped',
      },
    });
  } catch (err) {
    console.error('⚠️ Failed to log model image assignment event:', err);
  }
};

// ─── UPLOAD MODEL IMAGE ───────────────────────────────────────────────────────
export const uploadModelImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;
    const { name, image, fileSize, fileType, title, size, color, type, groupId } = req.body as {
      name: string;
      image: string;
      fileSize: number;
      fileType: string;
      title: string;
      size?: string;
      color?: string;
      type?: string;
      groupId?: string | null;
    };

    if (!name || !image || !fileSize || !fileType || !title) {
      throw new AppError('File name, image data, file size, file type, and title are required', 400);
    }

    let validGroupId: mongoose.Types.ObjectId | null = null;
    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      const groupExists = await ModelGroup.findOne({ _id: groupId, sellerId });
      if (!groupExists) {
        throw new AppError('Associated group not found', 404);
      }
      validGroupId = new mongoose.Types.ObjectId(groupId);
    }

    const newImage = await ModelImage.create({
      sellerId,
      groupId: validGroupId,
      name,
      image,
      fileSize,
      fileType,
      title,
      size: size || '',
      color: color || '',
      type: type || '',
    });

    // Log Activity
    await logModelImageActivity(sellerId, req.user!._id, req.user!.name, 'model_image_uploaded', newImage);

    res.status(201).json({
      success: true,
      message: 'Model image uploaded successfully',
      data: newImage,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET ALL MODEL IMAGES ────────────────────────────────────────────────────
export const getModelImages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;

    // Fetch all model images for this seller sorted by creation date descending
    const modelImages = await ModelImage.find({ sellerId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: modelImages,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE MODEL IMAGE ───────────────────────────────────────────────────────
export const deleteModelImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Image ID', 400);
    }

    const modelImage = await ModelImage.findOne({ _id: id, sellerId });
    if (!modelImage) {
      throw new AppError('Model image not found', 404);
    }

    await modelImage.deleteOne();

    // Log Activity
    await logModelImageActivity(sellerId, req.user!._id, req.user!.name, 'model_image_deleted', modelImage);

    res.status(200).json({
      success: true,
      message: 'Model image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─── CREATE MODEL GROUP ──────────────────────────────────────────────────────
export const createModelGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;
    const { title, size, color, type } = req.body as {
      title: string;
      size?: string;
      color?: string;
      type?: string;
    };

    if (!title) {
      throw new AppError('Group title is required', 400);
    }

    const newGroup = await ModelGroup.create({
      sellerId,
      title,
      size: size || '',
      color: color || '',
      type: type || '',
    });

    // Log Activity
    await logModelGroupActivity(sellerId, req.user!._id, req.user!.name, 'model_group_created', newGroup);

    res.status(201).json({
      success: true,
      message: 'Model group created successfully',
      data: newGroup,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET MODEL GROUPS ────────────────────────────────────────────────────────
export const getModelGroups = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;

    // Fetch all model groups sorted by creation date descending
    const groupsList = await ModelGroup.find({ sellerId }).sort({ createdAt: -1 });

    // Calculate count of model images in each group
    const groupsWithCounts = await Promise.all(
      groupsList.map(async (group) => {
        const imageCount = await ModelImage.countDocuments({ sellerId, groupId: group._id });
        return {
          ...group.toObject(),
          imageCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: groupsWithCounts,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE MODEL GROUP ──────────────────────────────────────────────────────
export const deleteModelGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Group ID', 400);
    }

    const group = await ModelGroup.findOne({ _id: id, sellerId });
    if (!group) {
      throw new AppError('Model group not found', 404);
    }

    await group.deleteOne();

    // Preserve images but set groupId to null (ungroup them)
    await ModelImage.updateMany(
      { sellerId, groupId: id },
      { $set: { groupId: null } }
    );

    // Log Activity
    await logModelGroupActivity(sellerId, req.user!._id, req.user!.name, 'model_group_deleted', group);

    res.status(200).json({
      success: true,
      message: `Model group "${group.title}" deleted. Associated photos have been ungrouped.`,
    });
  } catch (error) {
    next(error);
  }
};

// ─── ASSIGN IMAGE TO GROUP ───────────────────────────────────────────────────
export const assignImageToGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;
    const { groupId } = req.body as { groupId: string | null };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Image ID', 400);
    }

    const modelImage = await ModelImage.findOne({ _id: id, sellerId });
    if (!modelImage) {
      throw new AppError('Model image not found', 404);
    }

    let targetGroup = null;
    if (groupId) {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new AppError('Invalid Group ID', 400);
      }
      targetGroup = await ModelGroup.findOne({ _id: groupId, sellerId });
      if (!targetGroup) {
        throw new AppError('Model group not found', 404);
      }
      modelImage.groupId = targetGroup._id;
    } else {
      modelImage.groupId = null;
    }

    await modelImage.save();

    // Log Activity
    await logModelImageAssignActivity(sellerId, req.user!._id, req.user!.name, modelImage, targetGroup);

    res.status(200).json({
      success: true,
      message: targetGroup
        ? `Image assigned to group "${targetGroup.title}" successfully`
        : 'Image removed from group successfully',
      data: modelImage,
    });
  } catch (error) {
    next(error);
  }
};
