import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  sprintId?: mongoose.Types.ObjectId | null;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  assigneeType: 'member' | 'manual';
  assigneeMember?: mongoose.Types.ObjectId | null;
  assigneeName?: string;
  storyPoints: number;
  storyPointsType: 'fibonacci' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const taskSchema = new Schema<ITask>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller ID is required'],
    },
    sprintId: {
      type: Schema.Types.ObjectId,
      ref: 'Sprint',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'],
      default: 'backlog',
    },
    assigneeType: {
      type: String,
      enum: ['member', 'manual'],
      default: 'manual',
    },
    assigneeMember: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assigneeName: {
      type: String,
      trim: true,
      default: '',
    },
    storyPoints: {
      type: Number,
      default: 0,
    },
    storyPointsType: {
      type: String,
      enum: ['fibonacci', 'manual'],
      default: 'fibonacci',
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ sellerId: 1, sprintId: 1, status: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────
const Task: Model<ITask> = mongoose.model<ITask>('Task', taskSchema);
export default Task;
