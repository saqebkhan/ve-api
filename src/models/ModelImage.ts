import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IModelImage extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  name: string;      // Original filename
  image: string;     // Base64 Data URI
  fileSize: number;  // File size in bytes
  fileType: string;  // MIME type (e.g. image/png)
  title: string;     // Title metadata
  size?: string;     // Model size metadata (e.g. S, M, L)
  color?: string;    // Product color association
  type?: string;     // Image type (e.g. Lookbook, Catalog, Campaign)
  groupId?: mongoose.Types.ObjectId | null; // Associated group ID
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const modelImageSchema = new Schema<IModelImage>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller ID is required'],
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'ModelGroup',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    image: {
      type: String,
      required: [true, 'Image data is required'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
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

modelImageSchema.index({ sellerId: 1, createdAt: -1 });

// ─── Model ────────────────────────────────────────────────────────────────────
const ModelImage: Model<IModelImage> = mongoose.model<IModelImage>('ModelImage', modelImageSchema);
export default ModelImage;
