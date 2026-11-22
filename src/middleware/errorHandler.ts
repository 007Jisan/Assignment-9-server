import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('API Error:', err);

  let statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  // If this is a Stripe-related error, do not treat it as a user session 401 error
  if (err.type && (err.type.startsWith('Stripe') || err.name === 'StripeError')) {
    statusCode = err.type === 'StripeCardError' ? 400 : 500;
  }

  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
