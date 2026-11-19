import express, { Request, Response } from 'express';
import { MenuItem } from '../models/MenuItem';
import { User } from '../models/User';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

const populateVendorInMemory = (item: any) => {
  const vendor = dbStore.findUserById(item.vendorId);
  return {
    ...item,
    vendorId: vendor
      ? {
          _id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          image: vendor.image,
          businessName: vendor.businessName,
          subscriptionPlan: vendor.subscriptionPlan,
          isBlocked: vendor.isBlocked,
        }
      : null,
  };
};

// GET /api/menu - Public browse with search, filter, sort & pagination
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { search, category, location, sort, page = '1', limit = '12' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    if (isConnectedToMongoDB) {
      const query: any = { status: 'approved' };

      if (search && typeof search === 'string' && search.trim() !== '') {
        query.$or = [
          { itemName: { $regex: search.trim(), $options: 'i' } },
          { description: { $regex: search.trim(), $options: 'i' } },
        ];
      }

      if (category && typeof category === 'string' && category.trim() !== '' && category !== 'All') {
        query.category = category.trim();
      }

      if (location && typeof location === 'string' && location.trim() !== '' && location !== 'All') {
        query.location = { $regex: location.trim(), $options: 'i' };
      }

      let sortOption: any = { createdAt: -1 };
      if (sort === 'price_asc') sortOption = { price: 1 };
      else if (sort === 'price_desc') sortOption = { price: -1 };
      else if (sort === 'rating') sortOption = { rating: -1, reviewCount: -1 };
      else if (sort === 'newest') sortOption = { createdAt: -1 };

      const total = await MenuItem.countDocuments(query);
      const items = await MenuItem.find(query)
        .populate('vendorId', 'name image businessName subscriptionPlan isBlocked')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum);

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
    } else {
      let items = dbStore.getMenuItems().filter((i) => i.status === 'approved');

      if (search && typeof search === 'string' && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        items = items.filter(
          (i) => i.itemName.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
        );
      }

      if (category && typeof category === 'string' && category.trim() !== '' && category !== 'All') {
        items = items.filter((i) => i.category.toLowerCase() === (category as string).trim().toLowerCase());
      }

      if (location && typeof location === 'string' && location.trim() !== '' && location !== 'All') {
        const loc = (location as string).trim().toLowerCase();
        items = items.filter((i) => i.location.toLowerCase().includes(loc));
      }

      // Sort
      if (sort === 'price_asc') {
        items.sort((a, b) => a.price - b.price);
      } else if (sort === 'price_desc') {
        items.sort((a, b) => b.price - a.price);
      } else if (sort === 'rating') {
        items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else {
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      const total = items.length;
      const paginated = items.slice(skip, skip + limitNum).map(populateVendorInMemory);
      const filtered = paginated.filter((i) => !i.vendorId?.isBlocked);

      res.status(200).json({
        success: true,
        data: filtered,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/featured - At least 6 approved active items, prioritizing premium vendors
router.get('/featured', async (req: Request, res: Response, next) => {
  try {
    if (isConnectedToMongoDB) {
      const items = await MenuItem.find({ status: 'approved' })
        .populate('vendorId', 'name image businessName subscriptionPlan isBlocked')
        .sort({ createdAt: -1 })
        .limit(12);

      const activeItems = items.filter((item: any) => !item.vendorId?.isBlocked);

      const sorted = activeItems.sort((a: any, b: any) => {
        const aPrem = a.vendorId?.subscriptionPlan === 'premium' ? 1 : 0;
        const bPrem = b.vendorId?.subscriptionPlan === 'premium' ? 1 : 0;
        return bPrem - aPrem;
      });

      res.status(200).json({
        success: true,
        data: sorted.slice(0, 8),
      });
    } else {
      const all = dbStore.getMenuItems().filter((i) => i.status === 'approved');
      const populated = all.map(populateVendorInMemory).filter((i) => !i.vendorId?.isBlocked);

      populated.sort((a, b) => {
        const aPrem = a.vendorId?.subscriptionPlan === 'premium' ? 1 : 0;
        const bPrem = b.vendorId?.subscriptionPlan === 'premium' ? 1 : 0;
        if (bPrem !== aPrem) return bPrem - aPrem;
        return (b.rating || 0) - (a.rating || 0);
      });

      res.status(200).json({
        success: true,
        data: populated.slice(0, 8),
      });
    }
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

    if (isConnectedToMongoDB) {
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
    } else {
      const approvedItems = dbStore.getMenuItems().filter((i) => i.status === 'approved');
      const countMap: Record<string, number> = {};
      approvedItems.forEach((i) => {
        countMap[i.category] = (countMap[i.category] || 0) + 1;
      });

      const result = categories.map((cat) => ({
        name: cat,
        count: countMap[cat] || 0,
      }));

      res.status(200).json({ success: true, data: result });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/locations - Unique locations list
router.get('/locations', async (req: Request, res: Response, next) => {
  try {
    if (isConnectedToMongoDB) {
      const locations = await MenuItem.distinct('location', { status: 'approved' });
      res.status(200).json({ success: true, data: locations.filter(Boolean) });
    } else {
      const locs = Array.from(
        new Set(
          dbStore
            .getMenuItems()
            .filter((i) => i.status === 'approved')
            .map((i) => i.location)
        )
      );
      res.status(200).json({ success: true, data: locs });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/:id - Single item details
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    if (isConnectedToMongoDB) {
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
    } else {
      const raw = dbStore.findMenuItemById(id);
      if (!raw) {
        res.status(404).json({ success: false, message: 'Pizza menu item not found.' });
        return;
      }
      const item = populateVendorInMemory(raw);
      res.status(200).json({
        success: true,
        data: item,
      });
    }
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

      if (isConnectedToMongoDB) {
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
      } else {
        if (vendor.subscriptionPlan === 'free') {
          const vendorItems = dbStore
            .getMenuItems()
            .filter(
              (i) => i.vendorId === vendor._id.toString() && (i.status === 'approved' || i.status === 'pending')
            );

          if (vendorItems.length >= 3) {
            res.status(403).json({
              success: false,
              message:
                'Free plan limit reached (maximum 3 active menu items). Upgrade to Premium for unlimited items and featured placement!',
              planLimitReached: true,
            });
            return;
          }
        }

        const newItem = dbStore.createMenuItem({
          vendorId: vendor._id.toString(),
          itemName,
          category,
          description,
          price: Number(price),
          location,
          images,
          status: 'pending',
          rating: 5.0,
          reviewCount: 0,
        });

        res.status(201).json({
          success: true,
          message: 'Menu item submitted successfully! Pending admin approval before going live.',
          data: newItem,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
