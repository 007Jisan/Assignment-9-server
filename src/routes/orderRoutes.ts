import express, { Response } from 'express';
import { Order } from '../models/Order';
import { MenuItem } from '../models/MenuItem';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

const populateOrderInMemory = (order: any) => {
  const item = dbStore.findMenuItemById(typeof order.itemId === 'string' ? order.itemId : order.itemId?._id);
  const vendor = dbStore.findUserById(typeof order.vendorId === 'string' ? order.vendorId : order.vendorId?._id);
  const customer = dbStore.findUserById(typeof order.customerId === 'string' ? order.customerId : order.customerId?._id);

  return {
    ...order,
    itemId: item || order.itemId,
    vendorId: vendor
      ? {
          _id: vendor._id,
          name: vendor.name,
          email: vendor.email,
          businessName: vendor.businessName,
          image: vendor.image,
        }
      : order.vendorId,
    customerId: customer
      ? {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          image: customer.image,
        }
      : order.customerId,
  };
};

// POST /api/orders - Submit a pizza order (Customer only)
router.post('/', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const { itemId, deliveryDate, deliveryAddress, message } = req.body;
    const customerId = req.user!._id.toString();

    if (!itemId || !deliveryDate || !deliveryAddress) {
      res.status(400).json({
        success: false,
        message: 'Please provide itemId, deliveryDate, and deliveryAddress.',
      });
      return;
    }

    if (isConnectedToMongoDB) {
      const item = await MenuItem.findById(itemId);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }

      if (item.status !== 'approved') {
        res.status(400).json({
          success: false,
          message: 'This menu item is not currently available for ordering.',
        });
        return;
      }

      if (item.vendorId.toString() === customerId) {
        res.status(403).json({
          success: false,
          message: 'You cannot place an order for your own menu item.',
        });
        return;
      }

      const existingOrder = await Order.findOne({
        itemId,
        customerId,
        deliveryDate,
        status: { $in: ['pending', 'accepted'] },
      });

      if (existingOrder) {
        res.status(400).json({
          success: false,
          message: `You already have an active order for this pizza on ${deliveryDate}.`,
        });
        return;
      }

      const newOrder = await Order.create({
        itemId,
        vendorId: item.vendorId,
        customerId,
        deliveryDate,
        deliveryAddress,
        message: message || '',
        status: 'pending',
        statusTimeline: [
          {
            status: 'pending',
            timestamp: new Date(),
            note: 'Order placed by customer and awaiting restaurant confirmation.',
          },
        ],
      });

      const populated = await Order.findById(newOrder._id)
        .populate('itemId', 'itemName price images category location')
        .populate('vendorId', 'name businessName image')
        .populate('customerId', 'name email image');

      res.status(201).json({
        success: true,
        message: 'Pizza order placed successfully! The restaurant will review your order.',
        data: populated,
      });
    } else {
      const item = dbStore.findMenuItemById(itemId);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }

      if (item.status !== 'approved') {
        res.status(400).json({
          success: false,
          message: 'This menu item is not currently available for ordering.',
        });
        return;
      }

      if (item.vendorId.toString() === customerId) {
        res.status(403).json({
          success: false,
          message: 'You cannot place an order for your own menu item.',
        });
        return;
      }

      const existingOrder = dbStore
        .getOrders()
        .find(
          (o) =>
            o.itemId === itemId &&
            o.customerId === customerId &&
            o.deliveryDate === deliveryDate &&
            (o.status === 'pending' || o.status === 'accepted')
        );

      if (existingOrder) {
        res.status(400).json({
          success: false,
          message: `You already have an active order for this pizza on ${deliveryDate}.`,
        });
        return;
      }

      const newOrder = dbStore.createOrder({
        itemId,
        vendorId: item.vendorId,
        customerId,
        deliveryDate,
        deliveryAddress,
        message: message || '',
        status: 'pending',
        statusTimeline: [
          {
            status: 'pending',
            timestamp: new Date().toISOString(),
            note: 'Order placed by customer and awaiting restaurant confirmation.',
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: 'Pizza order placed successfully! The restaurant will review your order.',
        data: populateOrderInMemory(newOrder),
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/my-orders - Customer gets their order history
router.get('/my-orders', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const customerId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const orders = await Order.find({ customerId })
        .populate('itemId', 'itemName price images category location')
        .populate('vendorId', 'name businessName image email')
        .sort({ createdAt: -1 });

      const total = orders.length;
      const pending = orders.filter((o) => o.status === 'pending').length;
      const accepted = orders.filter((o) => o.status === 'accepted').length;
      const rejected = orders.filter((o) => o.status === 'rejected').length;
      const cancelled = orders.filter((o) => o.status === 'cancelled').length;

      res.status(200).json({
        success: true,
        data: orders,
        stats: { total, pending, accepted, rejected, cancelled },
      });
    } else {
      const rawOrders = dbStore
        .getOrders()
        .filter((o) => o.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const orders = rawOrders.map(populateOrderInMemory);
      const total = orders.length;
      const pending = orders.filter((o) => o.status === 'pending').length;
      const accepted = orders.filter((o) => o.status === 'accepted').length;
      const rejected = orders.filter((o) => o.status === 'rejected').length;
      const cancelled = orders.filter((o) => o.status === 'cancelled').length;

      res.status(200).json({
        success: true,
        data: orders,
        stats: { total, pending, accepted, rejected, cancelled },
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/:id - Single order details
router.get('/:id', verifyToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id.toString();
    const userRole = req.user!.role;

    if (isConnectedToMongoDB) {
      const order = await Order.findById(id)
        .populate('itemId', 'itemName price images category description location')
        .populate('vendorId', 'name businessName image email')
        .populate('customerId', 'name email image');

      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }

      const isCustomer = order.customerId?._id?.toString() === userId;
      const isVendor = order.vendorId?._id?.toString() === userId;
      const isAdmin = userRole === 'admin';

      if (!isCustomer && !isVendor && !isAdmin) {
        res.status(403).json({ success: false, message: 'Forbidden. You do not have access to this order.' });
        return;
      }

      res.status(200).json({ success: true, data: order });
    } else {
      const raw = dbStore.findOrderById(id);
      if (!raw) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }

      const isCustomer = raw.customerId === userId;
      const isVendor = raw.vendorId === userId;
      const isAdmin = userRole === 'admin';

      if (!isCustomer && !isVendor && !isAdmin) {
        res.status(403).json({ success: false, message: 'Forbidden. You do not have access to this order.' });
        return;
      }

      res.status(200).json({ success: true, data: populateOrderInMemory(raw) });
    }
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id/cancel - Customer cancels a pending order
router.put('/:id/cancel', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const order = await Order.findById(id);
      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }

      if (order.customerId.toString() !== customerId) {
        res.status(403).json({ success: false, message: 'Forbidden. You cannot cancel another user’s order.' });
        return;
      }

      if (order.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: `Order cannot be cancelled because its current status is "${order.status}".`,
        });
        return;
      }

      order.status = 'cancelled';
      order.statusTimeline.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: 'Order was cancelled by the customer.',
      });

      await order.save();
      res.status(200).json({ success: true, message: 'Order cancelled successfully.', data: order });
    } else {
      const order = dbStore.findOrderById(id);
      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }

      if (order.customerId !== customerId) {
        res.status(403).json({ success: false, message: 'Forbidden. You cannot cancel another user’s order.' });
        return;
      }

      if (order.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: `Order cannot be cancelled because its current status is "${order.status}".`,
        });
        return;
      }

      const timeline = order.statusTimeline || [];
      timeline.push({
        status: 'cancelled',
        timestamp: new Date().toISOString(),
        note: 'Order was cancelled by the customer.',
      });

      const updated = dbStore.updateOrder(id, {
        status: 'cancelled',
        statusTimeline: timeline,
      });

      res.status(200).json({ success: true, message: 'Order cancelled successfully.', data: updated });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
