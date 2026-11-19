import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16' as any,
});

// Helper function to activate premium plan and create transaction
export const activatePremiumSubscription = async (
  vendorId: string,
  amount: number,
  currency: string,
  stripeSessionId: string,
  stripeSubscriptionId?: string
) => {
  const vendor = await User.findById(vendorId);
  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  // Activate premium subscription for 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  vendor.subscriptionPlan = 'premium';
  vendor.subscriptionExpiresAt = expiresAt;
  await vendor.save();

  // Create permanent transaction record
  const transaction = await Transaction.create({
    vendorId: vendor._id,
    plan: 'premium',
    amount: amount / 100, // convert cents to dollars
    currency: currency || 'usd',
    stripeSessionId: stripeSessionId || '',
    stripeSubscriptionId: stripeSubscriptionId || '',
    status: 'succeeded',
  });

  console.log(`[Stripe Webhook] Successfully activated Premium for vendor: ${vendor.name} (${vendor._id})`);
  return transaction;
};

// POST /api/webhook/stripe - Stripe webhook listener with signature verification
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
      if (endpointSecret && sig && !endpointSecret.includes('placeholder')) {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        // Fallback for local testing or mock events
        event = JSON.parse(req.body.toString());
      }
    } catch (err: any) {
      console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle checkout.session.completed event
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

// POST /api/webhook/simulate-success (For testing environments when testing without Stripe CLI)
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
