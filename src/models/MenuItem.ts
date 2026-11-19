import mongoose, { Document, Schema } from 'mongoose';

export interface IMenuItem extends Document {
  vendorId: mongoose.Types.ObjectId;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  rating?: number;
  reviewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itemName: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        'Classic Pizzas',
        'Vegetarian Pizzas',
        'Meat Lovers',
        'Specialty / Gourmet Pizzas',
        'Sides & Appetizers',
        'Beverages & Desserts',
      ],
    },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    location: { type: String, required: true, trim: true },
    images: {
      type: [String],
      required: true,
      validate: [(val: string[]) => val.length > 0, 'At least one image is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'inactive'],
      default: 'pending',
      required: true,
      index: true,
    },
    rating: { type: Number, default: 5 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index for fast public menu searching and filtering
MenuItemSchema.index({ status: 1, category: 1, location: 1, price: 1 });
MenuItemSchema.index({ itemName: 'text', description: 'text' });

export const MenuItem = mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);
