import express, { Response } from 'express';
import { User } from '../models/User';
import { MenuItem } from '../models/MenuItem';
import { Order } from '../models/Order';
import { Transaction } from '../models/Transaction';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

// Middleware: all admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireRole('admin'));

const populateVendorInMemory = (item: any) => {
  const vendor = dbStore.findUserById(typeof item.vendorId === 'string' ? item.vendorId : item.vendorId?._id);
  return {
    ...item,
    vendorId: vendor
      ? {
          _id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          businessName: vendor.businessName,
          subscriptionPlan: vendor.subscriptionPlan,
          image: vendor.image,
        }
      : item.vendorId,
  };
};

// GET /api/admin/stats - Admin dashboard overview metrics
router.get('/stats', async (req: AuthRequest, res: Response, next) => {
  try {
    if (isConnectedToMongoDB) {
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
    } else {
      const users = dbStore.getUsers();
      const menuItems = dbStore.getMenuItems();
      const orders = dbStore.getOrders();
      const transactions = dbStore.getTransactions();

      const totalUsers = users.length;
      const totalVendors = users.filter((u) => u.role === 'vendor').length;
      const totalCustomers = users.filter((u) => u.role === 'customer').length;
      const totalMenuItems = menuItems.length;
      const pendingMenuItems = menuItems.filter((i) => i.status === 'pending').length;
      const approvedMenuItems = menuItems.filter((i) => i.status === 'approved').length;
      const totalOrders = orders.length;
      const totalTransactions = transactions.length;
      const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

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
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users - List users with search and role filter
router.get('/users', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search, role, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (isConnectedToMongoDB) {
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
    } else {
      let users = dbStore.getUsers().map((u) => {
        const { password, ...safe } = u;
        return safe;
      });

      if (search && typeof search === 'string' && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        users = users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.businessName && u.businessName.toLowerCase().includes(q))
        );
      }

      if (role && typeof role === 'string' && role !== 'all') {
        users = users.filter((u) => u.role === role.trim());
      }

      const total = users.length;
      users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const paginated = users.slice(skip, skip + limitNum);

      res.status(200).json({
        success: true,
        data: paginated,
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

// PUT /api/admin/users/:id/block - Block or unblock a user
router.put('/users/:id/block', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user!._id.toString();

    if (id === adminId) {
      res.status(400).json({ success: false, message: 'You cannot block your own admin account.' });
      return;
    }

    if (isConnectedToMongoDB) {
      const user = await User.findById(id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

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
    } else {
      const user = dbStore.findUserById(id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }

      const updated = dbStore.updateUser(id, { isBlocked: !user.isBlocked });

      res.status(200).json({
        success: true,
        message: `User ${updated!.name} has been ${updated!.isBlocked ? 'blocked' : 'unblocked'}.`,
        data: {
          _id: updated!._id,
          name: updated!.name,
          email: updated!.email,
          isBlocked: updated!.isBlocked,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/menu-items - List all menu items for review
router.get('/menu-items', async (req: AuthRequest, res: Response, next) => {
  try {
    const { search, status, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    if (isConnectedToMongoDB) {
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
    } else {
      let items = dbStore.getMenuItems();

      if (search && typeof search === 'string' && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        items = items.filter(
          (i) =>
            i.itemName.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q) ||
            i.location.toLowerCase().includes(q)
        );
      }

      if (status && typeof status === 'string' && status !== 'all') {
        items = items.filter((i) => i.status === status.trim());
      }

      const total = items.length;
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const paginated = items.slice(skip, skip + limitNum).map(populateVendorInMemory);

      res.status(200).json({
        success: true,
        data: paginated,
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

// PUT /api/admin/menu-items/:id/status - Approve, reject or change status
router.put('/menu-items/:id/status', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'inactive', 'pending'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status.' });
      return;
    }

    if (isConnectedToMongoDB) {
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
    } else {
      const item = dbStore.findMenuItemById(id);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }

      const updated = dbStore.updateMenuItem(id, { status });

      res.status(200).json({
        success: true,
        message: `Menu item status updated to "${status}".`,
        data: updated,
      });
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/menu-items/:id - Delete inappropriate items
router.delete('/menu-items/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    if (isConnectedToMongoDB) {
      const item = await MenuItem.findByIdAndDelete(id);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }
      res.status(200).json({ success: true, message: 'Menu item permanently removed.' });
    } else {
      const deleted = dbStore.deleteMenuItem(id);
      if (!deleted) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }
      res.status(200).json({ success: true, message: 'Menu item permanently removed.' });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/transactions - View all transactions (strictly read-only)
router.get('/transactions', async (req: AuthRequest, res: Response, next) => {
  try {
    if (isConnectedToMongoDB) {
      const transactions = await Transaction.find()
        .populate('vendorId', 'name email businessName image')
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: transactions });
    } else {
      const transactions = dbStore
        .getTransactions()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((t) => {
          const vendor = dbStore.findUserById(typeof t.vendorId === 'string' ? t.vendorId : t.vendorId?._id);
          return {
            ...t,
            vendorId: vendor
              ? {
                  _id: vendor._id,
                  name: vendor.name,
                  email: vendor.email,
                  businessName: vendor.businessName,
                  image: vendor.image,
                }
              : t.vendorId,
          };
        });

      res.status(200).json({ success: true, data: transactions });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
