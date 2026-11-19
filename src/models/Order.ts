import mongoose, { Document, Schema } from 'mongoose';

export interface IStatusTimelineItem {
  status: string;
  timestamp: Date;
  note: string;
}

export interface IOrder extends Document {
  itemId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  deliveryDate: string;
  deliveryAddress: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  statusTimeline: IStatusTimelineItem[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deliveryDate: { type: String, required: true },
    deliveryAddress: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },
    statusTimeline: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

// Prevent duplicate active orders for the same item and delivery date by the same customer
OrderSchema.index(
  { itemId: 1, customerId: 1, deliveryDate: 1, status: 1 },
  { name: 'unique_active_order' }
);

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
