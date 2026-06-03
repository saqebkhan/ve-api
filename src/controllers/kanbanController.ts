import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Sprint from '../models/Sprint';
import Task from '../models/Task';
import ActivityLog from '../models/ActivityLog';
import { AppError } from '../middleware/errorHandler';

// ─── Helper: Log Task Changes ─────────────────────────────────────────────────
const logTaskChange = async (
  sellerId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  userName: string,
  action: 'task_created' | 'task_updated' | 'task_deleted',
  task: any,
  oldTask?: any
) => {
  try {
    const details: any = {
      taskId: task._id,
      taskTitle: task.title,
    };

    if (action === 'task_updated' && oldTask) {
      const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];
      const fieldsToTrack = [
        'title',
        'description',
        'status',
        'assigneeType',
        'assigneeName',
        'storyPoints',
        'storyPointsType',
      ];

      for (const field of fieldsToTrack) {
        const oldVal = oldTask[field];
        const newVal = task[field];
        if (oldVal !== newVal) {
          changes.push({ field, oldVal, newVal });
        }
      }

      if (changes.length === 0) return;
      details.changes = changes;
    }

    await ActivityLog.create({
      sellerId,
      user: userId,
      userName,
      action,
      details,
    });
  } catch (err) {
    console.error('⚠️ Failed to log task activity event:', err);
  }
};

// ─── Helper: Log Sprint Changes ───────────────────────────────────────────────
const logSprintChange = async (
  sellerId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  userName: string,
  action: 'sprint_created' | 'sprint_completed',
  sprint: any
) => {
  try {
    await ActivityLog.create({
      sellerId,
      user: userId,
      userName,
      action,
      details: {
        sprintId: sprint._id,
        sprintName: sprint.name,
      },
    });
  } catch (err) {
    console.error('⚠️ Failed to log sprint activity event:', err);
  }
};

// ─── CREATE SPRINT ────────────────────────────────────────────────────────────
export const createSprint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;
    const { name, goal, description, startDate, endDate } = req.body as {
      name: string;
      goal: string;
      description?: string;
      startDate: string;
      endDate: string;
    };

    if (!name || !goal || !startDate || !endDate) {
      throw new AppError('Sprint name, sprint goal, start date, and end date are required', 400);
    }

    // Find the currently active sprint
    const activeSprint = await Sprint.findOne({ sellerId, status: 'active' });

    let rolledOverCount = 0;
    let newSprintId = new mongoose.Types.ObjectId();

    if (activeSprint) {
      // 1. Calculate achieved points for active sprint (Done tasks)
      const doneTasks = await Task.find({
        sellerId,
        sprintId: activeSprint._id,
        status: 'done',
      });
      const achievedStoryPoints = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

      // 2. Mark active sprint as completed
      activeSprint.status = 'completed';
      activeSprint.achievedStoryPoints = achievedStoryPoints;
      await activeSprint.save();
      await logSprintChange(sellerId, req.user!._id, req.user!.name, 'sprint_completed', activeSprint);

      // 3. Mark uncompleted tasks from this active sprint as null temporarily so they are gathered in the rollover search below
      await Task.updateMany(
        {
          sellerId,
          sprintId: activeSprint._id,
          status: { $ne: 'done' },
        },
        { $set: { sprintId: null } }
      );
    }

    // 4. Find all unsprinted, uncompleted tasks and transfer them to the new sprint
    const uncompletedTasks = await Task.find({
      sellerId,
      sprintId: null,
      status: { $ne: 'done' },
    });

    if (uncompletedTasks.length > 0) {
      rolledOverCount = uncompletedTasks.length;
      await Task.updateMany(
        {
          sellerId,
          sprintId: null,
          status: { $ne: 'done' },
        },
        { $set: { sprintId: newSprintId } }
      );
    }

    // 4. Create the new active sprint
    const newSprint = await Sprint.create({
      _id: newSprintId,
      sellerId,
      name,
      goal,
      description: description || '',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'active',
    });

    await logSprintChange(sellerId, req.user!._id, req.user!.name, 'sprint_created', newSprint);

    res.status(201).json({
      success: true,
      message: `Sprint "${name}" created successfully.${
        rolledOverCount > 0 ? ` ${rolledOverCount} task(s) rolled over.` : ''
      }`,
      data: newSprint,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET SPRINTS ──────────────────────────────────────────────────────────────
export const getSprints = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;

    // Fetch all sprints sorted by creation date descending
    const sprintsList = await Sprint.find({ sellerId }).sort({ createdAt: -1 });

    // For each sprint, calculate actual stats on-the-fly to be robust
    const sprintsWithStats = await Promise.all(
      sprintsList.map(async (sprint) => {
        const tasks = await Task.find({ sellerId, sprintId: sprint._id });
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.status === 'done').length;
        
        // Sum up story points of all tasks in sprint vs Done tasks
        const totalPoints = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        const achievedPoints = tasks
          .filter((t) => t.status === 'done')
          .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

        return {
          ...sprint.toObject(),
          stats: {
            totalTasks,
            completedTasks,
            totalPoints,
            achievedPoints,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: sprintsWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// ─── COMPLETE SPRINT MANUALLY ─────────────────────────────────────────────────
export const completeSprint = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Sprint ID', 400);
    }

    const sprint = await Sprint.findOne({ _id: id, sellerId });
    if (!sprint) {
      throw new AppError('Sprint not found', 404);
    }

    if (sprint.status === 'completed') {
      throw new AppError('Sprint is already completed', 400);
    }

    // Calculate achieved points
    const doneTasks = await Task.find({
      sellerId,
      sprintId: sprint._id,
      status: 'done',
    });
    const achievedStoryPoints = doneTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    sprint.status = 'completed';
    sprint.achievedStoryPoints = achievedStoryPoints;
    await sprint.save();

    await logSprintChange(sellerId, req.user!._id, req.user!.name, 'sprint_completed', sprint);

    // Roll uncompleted tasks back to global backlog (sprintId = null) since no active sprint is created yet
    await Task.updateMany(
      {
        sellerId,
        sprintId: sprint._id,
        status: { $ne: 'done' },
      },
      { $set: { sprintId: null } }
    );

    res.status(200).json({
      success: true,
      message: `Sprint "${sprint.name}" completed successfully. Uncompleted tasks moved to Backlog.`,
      data: sprint,
    });
  } catch (error) {
    next(error);
  }
};

// ─── CREATE TASK ──────────────────────────────────────────────────────────────
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;
    const {
      title,
      description,
      sprintId,
      status,
      assigneeType,
      assigneeMember,
      assigneeName,
      storyPoints,
      storyPointsType,
    } = req.body as {
      title: string;
      description?: string;
      sprintId?: string | null;
      status?: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
      assigneeType: 'member' | 'manual';
      assigneeMember?: string | null;
      assigneeName?: string;
      storyPoints?: number;
      storyPointsType: 'fibonacci' | 'manual';
    };

    if (!title) {
      throw new AppError('Task title is required', 400);
    }

    if (!sprintId || !mongoose.Types.ObjectId.isValid(sprintId)) {
      throw new AppError('Sprint ID is required. Tasks must belong to a sprint.', 400);
    }

    // Verify that the sprint exists and is active
    const targetSprint = await Sprint.findOne({ _id: sprintId, sellerId });
    if (!targetSprint) {
      throw new AppError('Sprint not found', 404);
    }
    if (targetSprint.status !== 'active') {
      throw new AppError('Cannot create tasks under a completed/inactive sprint.', 400);
    }

    const taskData: any = {
      sellerId,
      title,
      description: description || '',
      status: status || 'backlog',
      assigneeType,
      storyPoints: storyPoints || 0,
      storyPointsType,
      sprintId: new mongoose.Types.ObjectId(sprintId),
    };

    if (assigneeType === 'member') {
      if (assigneeMember && mongoose.Types.ObjectId.isValid(assigneeMember)) {
        taskData.assigneeMember = new mongoose.Types.ObjectId(assigneeMember);
        taskData.assigneeName = '';
      } else {
        throw new AppError('Assignee team member is required', 400);
      }
    } else {
      taskData.assigneeName = assigneeName || '';
      taskData.assigneeMember = null;
    }

    const task = await Task.create(taskData);
    
    // Log Activity
    await logTaskChange(sellerId, req.user!._id, req.user!.name, 'task_created', task);

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET TASKS ────────────────────────────────────────────────────────────────
export const getTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;
    const { sprintId } = req.query as { sprintId?: string };

    const filter: any = { sellerId };

    if (sprintId !== undefined) {
      if (sprintId === 'backlog' || sprintId === 'null' || sprintId === '') {
        filter.sprintId = null;
      } else if (mongoose.Types.ObjectId.isValid(sprintId)) {
        filter.sprintId = new mongoose.Types.ObjectId(sprintId);
      }
    }

    const tasks = await Task.find(filter)
      .populate('assigneeMember', 'name email role')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE TASK ──────────────────────────────────────────────────────────────
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Task ID', 400);
    }

    const oldTask = await Task.findOne({ _id: id, sellerId }).lean();
    if (!oldTask) {
      throw new AppError('Task not found', 404);
    }

    if (oldTask.sprintId) {
      const currentSprint = await Sprint.findOne({ _id: oldTask.sprintId, sellerId });
      if (currentSprint && currentSprint.status !== 'active') {
        throw new AppError('Cannot modify tasks belonging to a completed/inactive sprint.', 400);
      }
    }

    const body = req.body;
    const updateData: any = {};

    const updatableFields = [
      'title',
      'description',
      'status',
      'assigneeType',
      'assigneeName',
      'storyPoints',
      'storyPointsType',
    ];

    updatableFields.forEach((field) => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    if (body.sprintId !== undefined) {
      if (body.sprintId && mongoose.Types.ObjectId.isValid(body.sprintId)) {
        const targetSprint = await Sprint.findOne({ _id: body.sprintId, sellerId });
        if (!targetSprint) {
          throw new AppError('Target sprint not found', 404);
        }
        if (targetSprint.status !== 'active') {
          throw new AppError('Cannot move tasks to a completed/inactive sprint.', 400);
        }
        updateData.sprintId = new mongoose.Types.ObjectId(body.sprintId);
      } else {
        throw new AppError('Sprint ID is required. Tasks must belong to a sprint.', 400);
      }
    }

    if (body.assigneeType === 'member') {
      if (body.assigneeMember && mongoose.Types.ObjectId.isValid(body.assigneeMember)) {
        updateData.assigneeMember = new mongoose.Types.ObjectId(body.assigneeMember);
        updateData.assigneeName = '';
      }
    } else if (body.assigneeType === 'manual') {
      updateData.assigneeName = body.assigneeName || '';
      updateData.assigneeMember = null;
    }

    const updatedTask = await Task.findOneAndUpdate(
      { _id: id, sellerId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('assigneeMember', 'name email role');

    if (!updatedTask) {
      throw new AppError('Task not found', 404);
    }

    // Log Activity
    await logTaskChange(sellerId, req.user!._id, req.user!.name, 'task_updated', updatedTask, oldTask);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE TASK ──────────────────────────────────────────────────────────────
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Task ID', 400);
    }

    const task = await Task.findOne({ _id: id, sellerId });
    if (!task) {
      throw new AppError('Task not found', 404);
    }

    if (task.sprintId) {
      const sprint = await Sprint.findOne({ _id: task.sprintId, sellerId });
      if (sprint && sprint.status !== 'active') {
        throw new AppError('Cannot delete tasks belonging to a completed/inactive sprint.', 400);
      }
    }

    await task.deleteOne();
    
    // Log Activity
    await logTaskChange(sellerId, req.user!._id, req.user!.name, 'task_deleted', task);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
