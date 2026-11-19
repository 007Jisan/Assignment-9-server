import express, { Request, Response } from 'express';
import { MenuItem } from '../models/MenuItem';
import { User } from '../models/User';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// GET /api/menu - Public browse with search, filter, sort & pagination
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { search, category, location, sort, page = '1', limit = '12' } = req.query;

    const query: any = { status: 'approved' };

    // Search by item name or description
    if (search && typeof search === 'string' && search.trim() !== '') {
      query.$or = [
        { itemName: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Filter by category
    if (category && typeof category === 'string' && category.trim() !== '' && category !== 'All') {
      query.category = category.trim();
    }

    // Filter by location
    if (location && typeof location === 'string' && location.trim() !== '' && location !== 'All') {
      query.location = { $regex: location.trim(), $options: 'i' };
    }

    // Sorting: price_asc, price_desc, rating, newest
    let sortOption: any = { createdAt: -1 };
    if (sort === 'price_asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOption = { price: -1 };
    } else if (sort === 'rating') {
      sortOption = { rating: -1, reviewCount: -1 };
    } else if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const total = await MenuItem.countDocuments(query);
    const items = await MenuItem.find(query)
      .populate('vendorId', 'name image businessName subscriptionPlan isBlocked')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    // Filter out items whose vendor might be blocked
    const filteredItems = items.filter((item: any) => !item.vendorId?.isBlocked);

    res.status(200).json({
      success: true,
      data: filteredItems,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/featured - At least 6 approved active items, prioritizing premium vendors
router.get('/featured', async (req: Request, res: Response, next) => {
  try {
    const items = await MenuItem.find({ status: 'approved' })
      .populate('vendorId', 'name image businessName subscriptionPlan isBlocked')
      .sort({ createdAt: -1 })
      .limit(12);

    const activeItems = items.filter((item: any) => !item.vendorId?.isBlocked);

    // Prioritize premium vendors first
    const sorted = activeItems.sort((a: any, b: any) => {
      const aPrem = a.vendorId?.subscriptionPlan === 'premium' ? 1 : 0;
      const bPrem = b.vendorId?.subscriptionPlan === 'premium' ? 1 : 0;
      return bPrem - aPrem;
    });

    res.status(200).json({
      success: true,
      data: sorted.slice(0, 8),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/categories - Category breakdown with item count
router.get('/categories', async (req: Request, res: Response, next) => {
  try {
    const categories = [
      'Classic Pizzas',
      'Vegetarian Pizzas',
      'Meat Lovers',
      'Specialty / Gourmet Pizzas',
      'Sides & Appetizers',
      'Beverages & Desserts',
    ];

    const counts = await MenuItem.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    counts.forEach((c) => {
      countMap[c._id] = c.count;
    });

    const result = categories.map((cat) => ({
      name: cat,
      count: countMap[cat] || 0,
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/locations - Unique locations list
router.get('/locations', async (req: Request, res: Response, next) => {
  try {
    const locations = await MenuItem.distinct('location', { status: 'approved' });
    res.status(200).json({ success: true, data: locations.filter(Boolean) });
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/:id - Single item details
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const item = await MenuItem.findById(id).populate(
      'vendorId',
      'name email image businessName subscriptionPlan createdAt'
    );

    if (!item) {
      res.status(404).json({ success: false, message: 'Pizza menu item not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/menu - Vendor adds new menu item (Enforces Free tier max 3 active items)
router.post(
  '/',
  verifyToken,
  requireRole('vendor'),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { itemName, category, description, price, location, images } = req.body;
      const vendor = req.user!;

      if (!itemName || !category || !description || price === undefined || !location || !images) {
        res.status(400).json({ success: false, message: 'Please provide all required fields.' });
        return;
      }

      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json({ success: false, message: 'At least one image URL is required.' });
        return;
      }

      // Check subscription limits: Free vendors can only have max 3 active/pending/approved items
      if (vendor.subscriptionPlan === 'free') {
        const activeCount = await MenuItem.countDocuments({
          vendorId: vendor._id,
          status: { $in: ['approved', 'pending'] },
        });

        if (activeCount >= 3) {
          res.status(403).json({
            success: false,
            message:
              'Free plan limit reached (maximum 3 active menu items). Upgrade to Premium for unlimited items and featured placement!',
            planLimitReached: true,
          });
          return;
        }
      }

      const newItem = await MenuItem.create({
        vendorId: vendor._id,
        itemName,
        category,
        description,
        price: Number(price),
        location,
        images,
        status: 'pending', // default pending until admin approves
      });

      res.status(201).json({
        success: true,
        message: 'Menu item submitted successfully! Pending admin approval before going live.',
        data: newItem,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
