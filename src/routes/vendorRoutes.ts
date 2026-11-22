import express, { Response } from 'express';
import { getStripe } from '../config/stripe';
import { MenuItem } from '../models/MenuItem';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

// Middleware: all vendor routes require authentication and vendor role
router.use(verifyToken);
router.use(requireRole('vendor'));

// Helper to populate order in-memory
const populateOrderInMemory = (order: any) => {
  const item = dbStore.findMenuItemById(typeof order.itemId === 'string' ? order.itemId : order.itemId?._id);
  const customer = dbStore.findUserById(typeof order.customerId === 'string' ? order.customerId : order.customerId?._id);

  return {
    ...order,
    itemId: item || order.itemId,
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

// GET /api/vendor/stats - Vendor dashboard overview statistics
router.get('/stats', async (req: AuthRequest, res: Response, next) => {
  try {
    const vendorId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
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
    } else {
      const vendorItems = dbStore.getMenuItems().filter((i) => i.vendorId === vendorId);
      const totalItems = vendorItems.length;
      const activeItems = vendorItems.filter((i) => i.status === 'approved').length;

      const vendorOrders = dbStore.getOrders().filter((o) => o.vendorId === vendorId);
      const pendingOrders = vendorOrders.filter((o) => o.status === 'pending').length;
      const acceptedOrders = vendorOrders.filter((o) => o.status === 'accepted').length;

      const totalRevenue = vendorOrders
        .filter((o) => o.status === 'accepted')
        .reduce((sum, o) => {
          const item = dbStore.findMenuItemById(typeof o.itemId === 'string' ? o.itemId : o.itemId?._id);
          return sum + (item?.price || 0);
        }, 0);

      const recentOrders = vendorOrders
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(populateOrderInMemory);

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
          recentOrders,
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/vendor/menu-items - List all items for this vendor
router.get('/menu-items', async (req: AuthRequest, res: Response, next) => {
  try {
    const vendorId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const items = await MenuItem.find({ vendorId }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: items });
    } else {
      const items = dbStore
        .getMenuItems()
        .filter((i) => i.vendorId === vendorId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.status(200).json({ success: true, data: items });
    }
  } catch (error) {
    next(error);
  }
});

// PUT /api/vendor/menu-items/:id - Update vendor's menu item
router.put('/menu-items/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const vendorId = req.user!._id.toString();
    const { itemName, category, description, price, location, images, status } = req.body;

    if (isConnectedToMongoDB) {
      const item = await MenuItem.findById(id);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }

      if (item.vendorId.toString() !== vendorId) {
        res.status(403).json({ success: false, message: 'Forbidden. You do not own this menu item.' });
        return;
      }

      if (itemName) item.itemName = itemName;
      if (category) item.category = category;
      if (description) item.description = description;
      if (price !== undefined) item.price = Number(price);
      if (location) item.location = location;
      if (images && Array.isArray(images) && images.length > 0) item.images = images;

      if (status && ['inactive', 'pending', 'approved'].includes(status)) {
        if (status === 'inactive') {
          item.status = 'inactive';
        } else if (item.status === 'inactive' && status === 'approved') {
          item.status = 'approved';
        }
      }

      await item.save();
      res.status(200).json({ success: true, message: 'Menu item updated successfully!', data: item });
    } else {
      const item = dbStore.findMenuItemById(id);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }

      if (item.vendorId !== vendorId) {
        res.status(403).json({ success: false, message: 'Forbidden. You do not own this menu item.' });
        return;
      }

      const updates: any = {};
      if (itemName) updates.itemName = itemName;
      if (category) updates.category = category;
      if (description) updates.description = description;
      if (price !== undefined) updates.price = Number(price);
      if (location) updates.location = location;
      if (images && Array.isArray(images) && images.length > 0) updates.images = images;

      if (status && ['inactive', 'pending', 'approved'].includes(status)) {
        if (status === 'inactive') {
          updates.status = 'inactive';
        } else if (item.status === 'inactive' && status === 'approved') {
          updates.status = 'approved';
        }
      }

      const updated = dbStore.updateMenuItem(id, updates);
      res.status(200).json({ success: true, message: 'Menu item updated successfully!', data: updated });
    }
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vendor/menu-items/:id - Delete vendor's menu item
router.delete('/menu-items/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const vendorId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const item = await MenuItem.findById(id);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }

      if (item.vendorId.toString() !== vendorId) {
        res.status(403).json({ success: false, message: 'Forbidden. You do not own this menu item.' });
        return;
      }

      await MenuItem.findByIdAndDelete(id);
      res.status(200).json({ success: true, message: 'Menu item deleted successfully.' });
    } else {
      const item = dbStore.findMenuItemById(id);
      if (!item) {
        res.status(404).json({ success: false, message: 'Menu item not found.' });
        return;
      }

      if (item.vendorId !== vendorId) {
        res.status(403).json({ success: false, message: 'Forbidden. You do not own this menu item.' });
        return;
      }

      dbStore.deleteMenuItem(id);
      res.status(200).json({ success: true, message: 'Menu item deleted successfully.' });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/vendor/orders - View all customer orders for this vendor
router.get('/orders', async (req: AuthRequest, res: Response, next) => {
  try {
    const vendorId = req.user!._id.toString();

    if (isConnectedToMongoDB) {
      const orders = await Order.find({ vendorId })
        .populate('itemId', 'itemName price images category location')
        .populate('customerId', 'name email image')
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, data: orders });
    } else {
      const orders = dbStore
        .getOrders()
        .filter((o) => o.vendorId === vendorId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(populateOrderInMemory);

      res.status(200).json({ success: true, data: orders });
    }
  } catch (error) {
    next(error);
  }
});

// PUT /api/vendor/orders/:id/status - Accept or Reject customer order
router.put('/orders/:id/status', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const vendorId = req.user!._id.toString();

    if (!['accept', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'Action must be "accept" or "reject".' });
      return;
    }

    if (isConnectedToMongoDB) {
      const order = await Order.findById(id);
      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }

      if (order.vendorId.toString() !== vendorId) {
        res.status(403).json({ success: false, message: 'Forbidden. This order belongs to another restaurant.' });
        return;
      }

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
      res.status(200).json({ success: true, message: `Order successfully ${newStatus}!`, data: order });
    } else {
      const order = dbStore.findOrderById(id);
      if (!order) {
        res.status(404).json({ success: false, message: 'Order not found.' });
        return;
      }

      if (order.vendorId !== vendorId) {
        res.status(403).json({ success: false, message: 'Forbidden. This order belongs to another restaurant.' });
        return;
      }

      if (order.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: `Order cannot be updated because its current status is already "${order.status}".`,
        });
        return;
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';
      const timeline = order.statusTimeline || [];
      timeline.push({
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: `Order was ${newStatus} by the restaurant.`,
      });

      const updated = dbStore.updateOrder(id, {
        status: newStatus,
        statusTimeline: timeline,
      });

      res.status(200).json({ success: true, message: `Order successfully ${newStatus}!`, data: updated });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/vendor/create-checkout-session - Create Stripe checkout session
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

    const isPlaceholder =
      !process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_SECRET_KEY.includes('placeholder') ||
      process.env.STRIPE_SECRET_KEY.startsWith('sk_test_placeholder');

    if (isPlaceholder) {
      res.status(200).json({
        success: true,
        url: `${clientUrl}/payment/success?session_id=demo_session_${Date.now()}&simulated=true`,
        message: 'Stripe session created (Demo Simulation Mode)',
      });
      return;
    }

    const stripe = getStripe();
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
            unit_amount: 1999,
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
