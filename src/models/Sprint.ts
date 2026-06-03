import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface ISprint extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  name: string;
  goal: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed';
  achievedStoryPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const sprintSchema = new Schema<ISprint>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Sprint name is required'],
      trim: true,
    },
    goal: {
      type: String,
      required: [true, 'Sprint goal is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    achievedStoryPoints: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

sprintSchema.index({ sellerId: 1, createdAt: -1 });

// ─── Model ────────────────────────────────────────────────────────────────────
const Sprint: Model<ISprint> = mongoose.model<ISprint>('Sprint', sprintSchema);
export default Sprint;
