import express, { Response } from 'express';
import { Favorite } from '../models/Favorite';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

// Middleware: Customer only
router.use(verifyToken);
router.use(requireRole('customer'));

// GET /api/favorites - Get customer's saved pizzas
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const favorites = await Favorite.find({ userId })
        .populate({
          path: 'itemId',
          populate: { path: 'vendorId', select: 'name businessName image' },
        })
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: favorites.map((f) => f.itemId).filter(Boolean),
      });
    } else {
      const userFavs = dbStore.getFavorites(userId);
      const items = userFavs
        .map((f) => {
          const item = dbStore.findMenuItemById(f.itemId);
          if (!item) return null;
          const vendor = dbStore.findUserById(item.vendorId);
          return {
            ...item,
            vendorId: vendor
              ? {
                  _id: vendor._id,
                  name: vendor.name,
                  businessName: vendor.businessName,
                  image: vendor.image,
                }
              : null,
          };
        })
        .filter(Boolean);

      res.status(200).json({
        success: true,
        data: items,
      });
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

    if (isConnectedToMongoDB) {
      const existing = await Favorite.findOne({ userId, itemId });

      if (existing) {
        await Favorite.findByIdAndDelete(existing._id);
        res.status(200).json({
          success: true,
          isFavorited: false,
          message: 'Removed from favorites.',
        });
      } else {
        await Favorite.create({ userId, itemId });
        res.status(201).json({
          success: true,
          isFavorited: true,
          message: 'Added to favorites!',
        });
      }
    } else {
      const result = dbStore.toggleFavorite(userId, itemId);
      res.status(200).json({
        success: true,
        isFavorited: result.isFavorited,
        message: result.isFavorited ? 'Added to favorites!' : 'Removed from favorites.',
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
