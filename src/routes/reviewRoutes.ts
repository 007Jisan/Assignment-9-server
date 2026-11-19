import express, { Response } from 'express';
import { Review } from '../models/Review';
import { MenuItem } from '../models/MenuItem';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

// GET /api/reviews/item/:itemId - Get reviews for a pizza
router.get('/item/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;

    if (isConnectedToMongoDB) {
      const reviews = await Review.find({ itemId })
        .populate('userId', 'name image')
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: reviews });
    } else {
      const reviews = dbStore
        .getReviews(itemId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((r) => {
          const user = dbStore.findUserById(typeof r.userId === 'string' ? r.userId : r.userId?._id);
          return {
            ...r,
            userId: user
              ? {
                  _id: user._id,
                  name: user.name,
                  image: user.image,
                }
              : r.userId,
          };
        });

      res.status(200).json({ success: true, data: reviews });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/reviews - Customer adds a review
router.post('/', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const { itemId, rating, comment } = req.body;
    const userId = req.user!._id.toString();

    if (!itemId || !rating || !comment) {
      res.status(400).json({ success: false, message: 'Please provide itemId, rating (1-5), and comment.' });
      return;
    }

    if (isConnectedToMongoDB) {
      const review = await Review.create({
        itemId,
        userId,
        rating: Number(rating),
        comment,
      });

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
    } else {
      const newReview = dbStore.createReview({
        itemId,
        userId,
        rating: Number(rating),
        comment,
      });

      const allReviews = dbStore.getReviews(itemId);
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

      dbStore.updateMenuItem(itemId, {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: allReviews.length,
      });

      const user = dbStore.findUserById(userId);

      res.status(201).json({
        success: true,
        message: 'Review submitted successfully!',
        data: {
          ...newReview,
          userId: user ? { _id: user._id, name: user.name, image: user.image } : userId,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
