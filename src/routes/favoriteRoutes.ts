import express, { Response } from 'express';
import { Favorite } from '../models/Favorite';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Middleware: Customer only
router.use(verifyToken);
router.use(requireRole('customer'));

// GET /api/favorites - Get customer's saved pizzas
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.user!._id;
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
  } catch (error) {
    next(error);
  }
});

// POST /api/favorites/toggle - Toggle favorite status
router.post('/toggle', async (req: AuthRequest, res: Response, next) => {
  try {
    const { itemId } = req.body;
    const userId = req.user!._id;

    if (!itemId) {
      res.status(400).json({ success: false, message: 'itemId is required.' });
      return;
    }

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
  } catch (error) {
    next(error);
  }
});

export default router;
