import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { getStripe } from '../config/stripe';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

// Helper function to activate premium plan and create transaction
export const activatePremiumSubscription = async (
  vendorId: string,
  amount: number,
  currency: string,
  stripeSessionId: string,
  stripeSubscriptionId?: string
) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  if (isConnectedToMongoDB) {
    const vendor = await User.findById(vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found`);
    }

    vendor.subscriptionPlan = 'premium';
    vendor.subscriptionExpiresAt = expiresAt;
    await vendor.save();

    const transaction = await Transaction.create({
      vendorId: vendor._id,
      plan: 'premium',
      amount: amount / 100,
      currency: currency || 'usd',
      stripeSessionId: stripeSessionId || '',
      stripeSubscriptionId: stripeSubscriptionId || '',
      status: 'succeeded',
    });

    console.log(`[Stripe Webhook] Successfully activated Premium for vendor: ${vendor.name} (${vendor._id})`);
    return transaction;
  } else {
    const vendor = dbStore.findUserById(vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found`);
    }

    dbStore.updateUser(vendorId, {
      subscriptionPlan: 'premium',
      subscriptionExpiresAt: expiresAt.toISOString(),
    });

    const transaction = dbStore.createTransaction({
      vendorId,
      plan: 'premium',
      amount: amount / 100,
      currency: currency || 'usd',
      stripeSessionId: stripeSessionId || '',
      stripeSubscriptionId: stripeSubscriptionId || '',
      status: 'succeeded',
    });

    console.log(`[Stripe Webhook] Successfully activated Premium for vendor: ${vendor.name} (${vendor._id})`);
    return transaction;
  }
};

// POST /api/webhook/stripe - Stripe webhook listener with signature verification
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    const stripe = getStripe();
    try {
      if (endpointSecret && sig && !endpointSecret.includes('placeholder')) {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const vendorId = session.metadata?.vendorId;
      const plan = session.metadata?.plan;

      if (vendorId && plan === 'premium') {
        try {
          const amount = session.amount_total || 1999;
          const currency = session.currency || 'usd';
          const sessionId = session.id;
          const subscriptionId = (session.subscription as string) || '';

          await activatePremiumSubscription(vendorId, amount, currency, sessionId, subscriptionId);
        } catch (error) {
          console.error('[Stripe Webhook] Error processing subscription activation:', error);
          res.status(500).json({ error: 'Failed to process subscription' });
          return;
        }
      }
    }

    res.status(200).json({ received: true });
  }
);

// GET /api/webhook/verify-session - Verify a real Stripe Checkout Session directly with Stripe API
router.get('/verify-session', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'sessionId is required.' });
      return;
    }

    if (sessionId.startsWith('demo_session_') || sessionId.startsWith('sim_sess_')) {
      res.status(200).json({ success: true, simulated: true });
      return;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session && (session.payment_status === 'paid' || session.status === 'complete')) {
      const vendorId = session.metadata?.vendorId;
      if (vendorId) {
        const amount = session.amount_total || 1999;
        const currency = session.currency || 'usd';
        const subscriptionId = (session.subscription as string) || '';
        const transaction = await activatePremiumSubscription(
          vendorId,
          amount,
          currency,
          session.id,
          subscriptionId
        );
        res.status(200).json({ success: true, verified: true, transaction });
        return;
      }
    }

    res.status(200).json({ success: false, message: 'Session is not paid or verified.' });
  } catch (error: any) {
    console.error('Failed to verify stripe session:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/webhook/simulate-success
router.post('/simulate-success', async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendorId } = req.body;

    if (!vendorId) {
      res.status(400).json({ success: false, message: 'VendorId is required.' });
      return;
    }

    const transaction = await activatePremiumSubscription(
      vendorId,
      1999,
      'usd',
      `sim_sess_${Date.now()}`
    );

    res.status(200).json({
      success: true,
      message: 'Demo Premium subscription activated successfully!',
      transaction,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
