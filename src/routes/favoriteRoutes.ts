import express, { Response } from 'express';
import mongoose from 'mongoose';
import { Favorite } from '../models/Favorite';
import { MenuItem } from '../models/MenuItem';
import { User } from '../models/User';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';
import { findSamplePizzaById } from '../models/samplePizzas';

const router = express.Router();

// Middleware: Customer only
router.use(verifyToken);
router.use(requireRole('customer'));

// Helper to resolve a pizza item by id (checks MongoDB first, falls back to sample pizzas & dbStore)
async function resolvePizzaItem(rawId: string) {
  if (!rawId) return null;

  // 1. Try finding in MongoDB MenuItem
  if (isConnectedToMongoDB && mongoose.Types.ObjectId.isValid(rawId)) {
    try {
      const dbItem = await MenuItem.findById(rawId).populate(
        'vendorId',
        'name businessName image subscriptionPlan isBlocked'
      );
      if (dbItem) {
        return dbItem.toObject ? dbItem.toObject() : dbItem;
      }
    } catch {
      // Continue to fallback
    }
  }

  // 2. Check sample pizzas dataset (e.g. 673cc0000000000000000001 - 0008)
  const samplePizza = findSamplePizzaById(rawId);
  if (samplePizza) {
    return samplePizza;
  }

  // 3. Fallback to in-memory store
  const storeItem = dbStore.findMenuItemById(rawId);
  if (storeItem) {
    const vendor = dbStore.findUserById(storeItem.vendorId);
    return {
      ...storeItem,
      vendorId: vendor
        ? {
            _id: vendor._id,
            name: vendor.name,
            businessName: vendor.businessName,
            image: vendor.image,
            subscriptionPlan: vendor.subscriptionPlan || 'premium',
          }
        : storeItem.vendorId,
    };
  }

  return null;
}

// GET /api/favorites - Get customer's saved pizzas
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const userQuery = mongoose.Types.ObjectId.isValid(userId)
        ? { $in: [userId, new mongoose.Types.ObjectId(userId)] }
        : userId;

      const favorites = await Favorite.find({ userId: userQuery }).sort({ createdAt: -1 });

      const items = await Promise.all(
        favorites.map(async (fav) => {
          const rawItemId = fav.itemId?.toString ? fav.itemId.toString() : String(fav.itemId);
          return await resolvePizzaItem(rawItemId);
        })
      );

      res.status(200).json({
        success: true,
        data: items.filter(Boolean),
      });
    } else {
      const userFavs = dbStore.getFavorites(userId);
      const items = await Promise.all(
        userFavs.map(async (f) => await resolvePizzaItem(f.itemId))
      );

      res.status(200).json({
        success: true,
        data: items.filter(Boolean),
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/favorites/ids - Get list of item IDs saved by customer
router.get('/ids', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const userQuery = mongoose.Types.ObjectId.isValid(userId)
        ? { $in: [userId, new mongoose.Types.ObjectId(userId)] }
        : userId;

      const favorites = await Favorite.find({ userId: userQuery }).select('itemId');
      const ids = favorites.map((f) => (f.itemId?.toString ? f.itemId.toString() : String(f.itemId))).filter(Boolean);
      res.status(200).json({ success: true, ids });
    } else {
      const userFavs = dbStore.getFavorites(userId);
      const ids = userFavs.map((f) => f.itemId);
      res.status(200).json({ success: true, ids });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/favorites/toggle - Toggle favorite status
router.post('/toggle', async (req: AuthRequest, res: Response, next) => {
  try {
    const { itemId } = req.body;
    const userId = req.user!._id.toString();

    if (!itemId) {
      res.status(400).json({ success: false, message: 'itemId is required.' });
      return;
    }

    const strItemId = String(itemId).trim();

    if (isConnectedToMongoDB) {
      const userQuery = mongoose.Types.ObjectId.isValid(userId)
        ? { $in: [userId, new mongoose.Types.ObjectId(userId)] }
        : userId;

      const itemQuery = mongoose.Types.ObjectId.isValid(strItemId)
        ? { $in: [strItemId, new mongoose.Types.ObjectId(strItemId)] }
        : strItemId;

      const existing = await Favorite.findOne({
        userId: userQuery,
        itemId: itemQuery,
      });

      if (existing) {
        await Favorite.findByIdAndDelete(existing._id);
        // Also keep dbStore in sync
        dbStore.toggleFavorite(userId, strItemId);
        res.status(200).json({
          success: true,
          isFavorited: false,
          message: 'Removed from wishlist.',
        });
      } else {
        await Favorite.create({
          userId: mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId,
          itemId: mongoose.Types.ObjectId.isValid(strItemId)
            ? new mongoose.Types.ObjectId(strItemId)
            : strItemId,
        });
        // Also keep dbStore in sync
        dbStore.toggleFavorite(userId, strItemId);
        res.status(201).json({
          success: true,
          isFavorited: true,
          message: 'Added to wishlist!',
        });
      }
    } else {
      const result = dbStore.toggleFavorite(userId, strItemId);
      res.status(200).json({
        success: true,
        isFavorited: result.isFavorited,
        message: result.isFavorited ? 'Added to wishlist!' : 'Removed from wishlist.',
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
