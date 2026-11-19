import express, { Response } from 'express';
import { User } from '../models/User';
import { MenuItem } from '../models/MenuItem';
import { Order } from '../models/Order';
import { Transaction } from '../models/Transaction';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Middleware: all admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireRole('admin'));

// GET /api/admin/stats - Admin dashboard overview metrics
router.get('/stats', async (req: AuthRequest, res: Response, next) => {
  try {
    const [
      totalUsers,
      totalVendors,
      totalCustomers,
      totalMenuItems,
      pendingMenuItems,
      approvedMenuItems,
      totalOrders,
      totalTransactions,
      transactionsList,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'vendor' }),
      User.countDocuments({ role: 'customer' }),
      MenuItem.countDocuments(),
      MenuItem.countDocuments({ status: 'pending' }),
      MenuItem.countDocuments({ status: 'approved' }),
      Order.countDocuments(),
      Transaction.countDocuments(),
      Transaction.find().sort({ createdAt: -1 }),
    ]);

    const totalRevenue = transactionsList.reduce((sum, t) => sum + (t.amount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalVendors,
        totalCustomers,
        totalMenuItems,
        pendingMenuItems,
        approvedMenuItems,
        totalOrders,
        totalTransactions,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users - List users with search and role filter
router.get('/users', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search, role, page = '1', limit = '20' } = req.query;

    const query: any = {};

    if (search && typeof search === 'string' && search.trim() !== '') {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { businessName: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (role && typeof role === 'string' && role !== 'all') {
      query.role = role.trim();
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      data: users,
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

// PUT /api/admin/users/:id/block - Block or unblock a user
router.put('/users/:id/block', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user!._id.toString();

    // Prevent admin from blocking self
    if (id === adminId) {
      res.status(400).json({ success: false, message: 'You cannot block your own admin account.' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Toggle block status
    user.isBlocked = !user.isBlocked;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.name} has been ${user.isBlocked ? 'blocked' : 'unblocked'}.`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/menu-items - List all menu items for review
router.get('/menu-items', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;

    const query: any = {};

    if (search && typeof search === 'string' && search.trim() !== '') {
      query.$or = [
        { itemName: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
        { location: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (status && typeof status === 'string' && status !== 'all') {
      query.status = status.trim();
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const total = await MenuItem.countDocuments(query);
    const items = await MenuItem.find(query)
      .populate('vendorId', 'name email businessName subscriptionPlan image')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      data: items,
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

// PUT /api/admin/menu-items/:id/status - Approve, reject or change status
router.put('/menu-items/:id/status', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' | 'rejected' | 'inactive' | 'pending'

    if (!['approved', 'rejected', 'inactive', 'pending'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status.' });
      return;
    }

    const item = await MenuItem.findById(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found.' });
      return;
    }

    item.status = status;
    await item.save();

    res.status(200).json({
      success: true,
      message: `Menu item status updated to "${status}".`,
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/menu-items/:id - Delete inappropriate items
router.delete('/menu-items/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const item = await MenuItem.findByIdAndDelete(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Menu item permanently removed.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/transactions - View all transactions (strictly read-only)
router.get('/transactions', async (req: AuthRequest, res: Response, next) => {
  try {
    const transactions = await Transaction.find()
      .populate('vendorId', 'name email businessName image')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
