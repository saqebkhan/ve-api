import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IInvitation extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  token: string;
  invitedBy: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'editor', 'viewer'],
      required: [true, 'Role is required'],
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'pending',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

invitationSchema.index({ token: 1 });
invitationSchema.index({ email: 1, sellerId: 1 });

const Invitation: Model<IInvitation> = mongoose.model<IInvitation>('Invitation', invitationSchema);
export default Invitation;
