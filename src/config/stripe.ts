import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

export const getStripe = (): Stripe => {
  const secretKey =
    process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder')
      ? process.env.STRIPE_SECRET_KEY
      : 'sk_test_placeholder';

  return new Stripe(secretKey, {
    apiVersion: '2024-04-10' as any,
  });
};
