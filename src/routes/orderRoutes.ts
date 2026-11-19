import express, { Response } from 'express';
import { Order } from '../models/Order';
import { MenuItem } from '../models/MenuItem';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

// POST /api/orders - Submit a pizza order (Customer only)
router.post('/', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const { itemId, deliveryDate, deliveryAddress, message } = req.body;
    const customerId = req.user!._id;

    if (!itemId || !deliveryDate || !deliveryAddress) {
      res.status(400).json({
        success: false,
        message: 'Please provide itemId, deliveryDate, and deliveryAddress.',
      });
      return;
    }

    const item = await MenuItem.findById(itemId);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found.' });
      return;
    }

    // Only approved and active items can be ordered
    if (item.status !== 'approved') {
      res.status(400).json({
        success: false,
        message: 'This menu item is not currently available for ordering.',
      });
      return;
    }

    // Security check: Prevent customer from ordering their own item (if vendor created it)
    if (item.vendorId.toString() === customerId.toString()) {
      res.status(403).json({
        success: false,
        message: 'You cannot place an order for your own menu item.',
      });
      return;
    }

    // Security check: Prevent duplicate active orders for the same item and delivery date
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
  } catch (error) {
    next(error);
  }
});

// GET /api/orders/my-orders - Customer gets their order history
router.get('/my-orders', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const customerId = req.user!._id;

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

    const order = await Order.findById(id)
      .populate('itemId', 'itemName price images category description location')
      .populate('vendorId', 'name businessName image email')
      .populate('customerId', 'name email image');

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    // Access control: customer, vendor of this order, or admin
    const isCustomer = order.customerId?._id?.toString() === userId;
    const isVendor = order.vendorId?._id?.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isVendor && !isAdmin) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not have access to this order.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/orders/:id/cancel - Customer cancels a pending order
router.put('/:id/cancel', verifyToken, requireRole('customer'), async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user!._id.toString();

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    // Ownership check
    if (order.customerId.toString() !== customerId) {
      res.status(403).json({ success: false, message: 'Forbidden. You cannot cancel another user’s order.' });
      return;
    }

    // Customers cannot cancel an order that is already accepted, rejected, or cancelled
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

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully.',
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
