import mongoose, { Document, Schema } from 'mongoose';

export interface IFavorite extends Document {
  userId: any;
  itemId: any;
  createdAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.Mixed, required: true, index: true },
    itemId: { type: Schema.Types.Mixed, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FavoriteSchema.index({ userId: 1, itemId: 1 });

export const Favorite = mongoose.model<IFavorite>('Favorite', FavoriteSchema);
