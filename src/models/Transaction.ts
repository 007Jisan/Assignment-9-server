import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  vendorId: mongoose.Types.ObjectId;
  plan: string;
  amount: number;
  currency: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  status: string;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    plan: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'usd', lowercase: true },
    stripeSessionId: { type: String, default: '' },
    stripeSubscriptionId: { type: String, default: '' },
    status: { type: String, default: 'succeeded' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
