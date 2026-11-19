import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

export interface AuthRequest extends Request {
  user?: any;
}

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'pizzahub_jwt_secret_dev_key_secure_2026_9999';
    const decoded = jwt.verify(token, secret) as { id: string; role: string };

    let user: any = null;
    if (isConnectedToMongoDB) {
      user = await User.findById(decoded.id).select('-password');
    } else {
      user = dbStore.findUserById(decoded.id);
      if (user) {
        // Strip password for safety
        const { password, ...safeUser } = user;
        user = safeUser;
      }
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found or session invalid.' });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        message: 'Account is blocked. You cannot access protected features.',
        isBlocked: true,
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.name === 'TokenExpiredError' ? 'Token expired. Please sign in again.' : 'Invalid token.',
    });
  }
};

export const requireRole = (...allowedRoles: ('customer' | 'vendor' | 'admin')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Only ${allowedRoles.join(' or ')} can perform this action.`,
      });
      return;
    }

    next();
  };
};
