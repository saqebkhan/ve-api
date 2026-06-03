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
  action:
    | 'product_created'
    | 'product_updated'
    | 'product_deleted'
    | 'task_created'
    | 'task_updated'
    | 'task_deleted'
    | 'sprint_created'
    | 'sprint_completed'
    | 'model_image_uploaded'
    | 'model_image_deleted'
    | 'model_group_created'
    | 'model_group_deleted'
    | 'model_image_assigned_group';
  details: {
    productId?: mongoose.Types.ObjectId | string;
    productName?: string;
    sku?: string;
    taskId?: mongoose.Types.ObjectId | string;
    taskTitle?: string;
    sprintId?: mongoose.Types.ObjectId | string;
    sprintName?: string;
    modelImageId?: mongoose.Types.ObjectId | string;
    modelImageTitle?: string;
    modelGroupId?: mongoose.Types.ObjectId | string;
    modelGroupTitle?: string;
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
      enum: [
        'product_created',
        'product_updated',
        'product_deleted',
        'task_created',
        'task_updated',
        'task_deleted',
        'sprint_created',
        'sprint_completed',
        'model_image_uploaded',
        'model_image_deleted',
        'model_group_created',
        'model_group_deleted',
        'model_image_assigned_group',
      ],
      required: true,
    },
    details: {
      productId: {
        type: Schema.Types.Mixed,
      },
      productName: {
        type: String,
      },
      sku: {
        type: String,
      },
      taskId: {
        type: Schema.Types.Mixed,
      },
      taskTitle: {
        type: String,
      },
      sprintId: {
        type: Schema.Types.Mixed,
      },
      sprintName: {
        type: String,
      },
      modelImageId: {
        type: Schema.Types.Mixed,
      },
      modelImageTitle: {
        type: String,
      },
      modelGroupId: {
        type: Schema.Types.Mixed,
      },
      modelGroupTitle: {
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
