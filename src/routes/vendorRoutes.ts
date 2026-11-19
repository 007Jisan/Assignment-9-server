import express, { Response } from 'express';
import Stripe from 'stripe';
import { MenuItem } from '../models/MenuItem';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16' as any,
});

// Middleware: all vendor routes require authentication and vendor role
router.use(verifyToken);
router.use(requireRole('vendor'));

// GET /api/vendor/stats - Vendor dashboard overview statistics
router.get('/stats', async (req: AuthRequest, res: Response, next) => {
  try {
    const vendorId = req.user!._id;

    const [totalItems, activeItems, pendingOrders, acceptedOrders, allOrders] = await Promise.all([
      MenuItem.countDocuments({ vendorId }),
      MenuItem.countDocuments({ vendorId, status: 'approved' }),
      Order.countDocuments({ vendorId, status: 'pending' }),
      Order.countDocuments({ vendorId, status: 'accepted' }),
      Order.find({ vendorId })
        .populate('itemId', 'itemName price images')
        .populate('customerId', 'name email image')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    // Calculate simulated or actual revenue from accepted orders
    const acceptedOrderList = await Order.find({ vendorId, status: 'accepted' }).populate('itemId', 'price');
    const totalRevenue = acceptedOrderList.reduce((acc, order: any) => {
      return acc + (order.itemId?.price || 0);
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        totalItems,
        activeItems,
        pendingOrders,
        acceptedOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        subscriptionPlan: req.user!.subscriptionPlan,
        subscriptionExpiresAt: req.user!.subscriptionExpiresAt,
        businessName: req.user!.businessName,
        recentOrders: allOrders,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/vendor/menu-items - List all items for this vendor
router.get('/menu-items', async (req: AuthRequest, res: Response, next) => {
  try {
    const vendorId = req.user!._id;
    const items = await MenuItem.find({ vendorId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/vendor/menu-items/:id - Update vendor's menu item
router.put('/menu-items/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const vendorId = req.user!._id;
    const { itemName, category, description, price, location, images, status } = req.body;

    const item = await MenuItem.findById(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found.' });
      return;
    }

    // Resource ownership verification
    if (item.vendorId.toString() !== vendorId.toString()) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this menu item.' });
      return;
    }

    if (itemName) item.itemName = itemName;
    if (category) item.category = category;
    if (description) item.description = description;
    if (price !== undefined) item.price = Number(price);
    if (location) item.location = location;
    if (images && Array.isArray(images) && images.length > 0) item.images = images;

    // Vendor can toggle availability between active/approved and inactive, or set back to pending on edit
    if (status && ['inactive', 'pending', 'approved'].includes(status)) {
      // If vendor re-enables an approved item that was set inactive
      if (status === 'inactive') {
        item.status = 'inactive';
      } else if (item.status === 'inactive' && status === 'approved') {
        item.status = 'approved';
      }
    }

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Menu item updated successfully!',
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vendor/menu-items/:id - Delete vendor's menu item
router.delete('/menu-items/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const vendorId = req.user!._id;

    const item = await MenuItem.findById(id);
    if (!item) {
      res.status(404).json({ success: false, message: 'Menu item not found.' });
      return;
    }

    // Ownership check
    if (item.vendorId.toString() !== vendorId.toString()) {
      res.status(403).json({ success: false, message: 'Forbidden. You do not own this menu item.' });
      return;
    }

    await MenuItem.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/vendor/orders - View all customer orders for this vendor
router.get('/orders', async (req: AuthRequest, res: Response, next) => {
  try {
    const vendorId = req.user!._id;
    const orders = await Order.find({ vendorId })
      .populate('itemId', 'itemName price images category location')
      .populate('customerId', 'name email image')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/vendor/orders/:id/status - Accept or Reject customer order
router.put('/orders/:id/status', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const vendorId = req.user!._id;

    if (!['accept', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action must be "accept" or "reject".' });
      return;
    }

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }

    // Security: Vendors cannot modify orders that belong to other vendors
    if (order.vendorId.toString() !== vendorId.toString()) {
      res.status(403).json({ success: false, message: 'Forbidden. This order belongs to another restaurant.' });
      return;
    }

    // Rule: Only pending orders can be accepted or rejected, and only once
    if (order.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Order cannot be updated because its current status is already "${order.status}".`,
      });
      return;
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';
    order.status = newStatus;

    order.statusTimeline.push({
      status: newStatus,
      timestamp: new Date(),
      note: `Order was ${newStatus} by the restaurant.`,
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order successfully ${newStatus}!`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vendor/create-checkout-session - Create Stripe checkout session for Premium Subscription
router.post('/create-checkout-session', async (req: AuthRequest, res: Response, next) => {
  try {
    const vendor = req.user!;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

    if (vendor.subscriptionPlan === 'premium') {
      res.status(400).json({
        success: false,
        message: 'You already have an active Premium subscription!',
      });
      return;
    }

    // Fallback if Stripe key is a placeholder or not provided
    const isPlaceholder =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes('placeholder') ||
      process.env.STRIPE_SECRET_KEY.startsWith('sk_test_placeholder');

    if (isPlaceholder) {
      // In demo/test mode without live Stripe key, provide a direct test activation URL or simulation
      res.status(200).json({
        success: true,
        url: `${clientUrl}/payment/success?session_id=demo_session_${Date.now()}&simulated=true`,
        message: 'Stripe session created (Demo Simulation Mode)',
      });
      return;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'PizzaHub Premium Vendor Subscription',
              description: 'Unlimited menu items, featured homepage placement, and official Premium badge.',
              images: ['https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800'],
            },
            unit_amount: 1999, // $19.99 USD
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel`,
      customer_email: vendor.email,
      metadata: {
        vendorId: vendor._id.toString(),
        plan: 'premium',
      },
    });

    res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
