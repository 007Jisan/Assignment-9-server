import express, { Response } from 'express';
import { Review } from '../models/Review';
import { MenuItem } from '../models/MenuItem';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/reviews/item/:itemId - Get reviews for a pizza
router.get('/item/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const reviews = await Review.find({ itemId })
      .populate('userId', 'name image')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

// POST /api/reviews - Customer adds a review
router.post('/', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const { itemId, rating, comment } = req.body;
    const userId = req.user!._id;

    if (!itemId || !rating || !comment) {
      res.status(400).json({ success: false, message: 'Please provide itemId, rating (1-5), and comment.' });
      return;
    }

    const review = await Review.create({
      itemId,
      userId,
      rating: Number(rating),
      comment,
    });

    // Update menu item average rating and count
    const allReviews = await Review.find({ itemId });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await MenuItem.findByIdAndUpdate(itemId, {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: allReviews.length,
    });

    const populated = await Review.findById(review._id).populate('userId', 'name image');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
