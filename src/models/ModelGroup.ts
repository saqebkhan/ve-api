import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IModelGroup extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  title: string;     // Title / Name of the group
  size?: string;     // Group size tag (e.g. M, L)
  color?: string;    // Associated color tag
  type?: string;     // Shoot type tag (e.g. Lookbook)
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const modelGroupSchema = new Schema<IModelGroup>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Group title is required'],
      trim: true,
    },
    size: {
      type: String,
      default: '',
      trim: true,
    },
    color: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

modelGroupSchema.index({ sellerId: 1, createdAt: -1 });

// ─── Model ────────────────────────────────────────────────────────────────────
const ModelGroup: Model<IModelGroup> = mongoose.model<IModelGroup>('ModelGroup', modelGroupSchema);
export default ModelGroup;
