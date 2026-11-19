import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: 'customer' | 'vendor' | 'admin';
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan: 'free' | 'premium';
  subscriptionExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    image: { type: String, default: '' },
    role: {
      type: String,
      enum: ['customer', 'vendor', 'admin'],
      default: 'customer',
      required: true,
    },
    isBlocked: { type: Boolean, default: false },
    businessName: { type: String, default: '' },
    subscriptionPlan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
      required: true,
    },
    subscriptionExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
