import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IActivityChange {
  field: string;
  oldVal: any;
  newVal: any;
}

export interface IActivityLog extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  userName: string;
  action: 'product_created' | 'product_updated' | 'product_deleted';
  details: {
    productId: mongoose.Types.ObjectId | string;
    productName: string;
    sku?: string;
    changes?: IActivityChange[];
  };
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      enum: ['product_created', 'product_updated', 'product_deleted'],
      required: true,
    },
    details: {
      productId: {
        type: Schema.Types.Mixed,
        required: true,
      },
      productName: {
        type: String,
        required: true,
      },
      sku: {
        type: String,
      },
      changes: [
        {
          field: { type: String, required: true },
          oldVal: { type: Schema.Types.Mixed },
          newVal: { type: Schema.Types.Mixed },
        },
      ],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only log creation time
  }
);

activityLogSchema.index({ sellerId: 1, createdAt: -1 });

const ActivityLog: Model<IActivityLog> = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
export default ActivityLog;
