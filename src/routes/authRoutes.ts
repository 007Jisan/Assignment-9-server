import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { verifyToken, AuthRequest } from '../middleware/auth';
import { isConnectedToMongoDB } from '../config/db';
import { dbStore } from '../models/store';

const router = express.Router();

const signToken = (id: string, role: string) => {
  const secret = process.env.JWT_SECRET || 'pizzahub_jwt_secret_dev_key_secure_2026_9999';
  return jwt.sign({ id, role }, secret, { expiresIn: '7d' });
};

// POST /api/auth/register - Actual registration with real validation & bcrypt hashing
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, image, role, businessName } = req.body;

    if (!name || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'Please provide all required fields.' });
      return;
    }

    // Role check: Only customer or vendor can be registered publicly
    if (role !== 'customer' && role !== 'vendor') {
      res.status(400).json({
        success: false,
        message: 'Invalid role. Public registration only allows Customer or Vendor accounts.',
      });
      return;
    }

    // Password validation: minimum 6 characters, one uppercase letter, one lowercase letter
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
    if (!passwordRegex.test(password)) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters and include at least one uppercase and one lowercase letter.',
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let newUser: any;

    if (isConnectedToMongoDB) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });
        return;
      }

      newUser = await User.create({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        image: image || '',
        role,
        businessName: role === 'vendor' ? businessName || `${name}'s Pizzeria` : undefined,
        subscriptionPlan: 'free',
        isBlocked: false,
      });
    } else {
      const existingUser = dbStore.findUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });
        return;
      }

      newUser = dbStore.createUser({
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        image: image || '',
        role,
        businessName: role === 'vendor' ? businessName || `${name}'s Pizzeria` : undefined,
        subscriptionPlan: 'free',
        isBlocked: false,
      });
    }

    const token = signToken(newUser._id.toString(), newUser.role);

    const safeUser = {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      image: newUser.image,
      role: newUser.role,
      businessName: newUser.businessName,
      subscriptionPlan: newUser.subscriptionPlan,
      isBlocked: newUser.isBlocked,
    };

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to PizzaHub.',
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login - Actual sign in verifying hashed password
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password.' });
      return;
    }

    let user: any = null;

    if (isConnectedToMongoDB) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else {
      user = dbStore.findUserByEmail(email);
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        message: 'Your account is blocked. Please contact platform support.',
        isBlocked: true,
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const token = signToken(user._id.toString(), user.role);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      businessName: user.businessName,
      subscriptionPlan: user.subscriptionPlan,
      isBlocked: user.isBlocked,
    };

    res.status(200).json({
      success: true,
      message: 'Signed in successfully!',
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/google - Google OAuth / Fast Sign In
router.post('/google', async (req, res, next) => {
  try {
    const { email, name, image, role = 'customer' } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required from Google auth.' });
      return;
    }

    let user: any = null;

    if (isConnectedToMongoDB) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        if (user.isBlocked) {
          res.status(403).json({
            success: false,
            message: 'Your account is blocked. Please contact support.',
            isBlocked: true,
          });
          return;
        }
      } else {
        const assignedRole = role === 'vendor' ? 'vendor' : 'customer';
        user = await User.create({
          name: name || 'Google User',
          email: email.toLowerCase(),
          image: image || '',
          role: assignedRole,
          businessName: assignedRole === 'vendor' ? `${name}'s Pizzeria` : undefined,
          subscriptionPlan: 'free',
          isBlocked: false,
        });
      }
    } else {
      user = dbStore.findUserByEmail(email);
      if (user) {
        if (user.isBlocked) {
          res.status(403).json({
            success: false,
            message: 'Your account is blocked. Please contact support.',
            isBlocked: true,
          });
          return;
        }
      } else {
        const assignedRole = role === 'vendor' ? 'vendor' : 'customer';
        user = dbStore.createUser({
          name: name || 'Google User',
          email: email.toLowerCase(),
          image: image || '',
          role: assignedRole,
          businessName: assignedRole === 'vendor' ? `${name}'s Pizzeria` : undefined,
          subscriptionPlan: 'free',
          isBlocked: false,
        });
      }
    }

    const token = signToken(user._id.toString(), user.role);

    const safeUser = {
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      businessName: user.businessName,
      subscriptionPlan: user.subscriptionPlan,
      isBlocked: user.isBlocked,
    };

    res.status(200).json({
      success: true,
      message: 'Google authentication successful!',
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Fetch authenticated user
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

// PUT /api/auth/profile - Update user profile
router.put('/profile', verifyToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, image, businessName } = req.body;
    const userId = req.user!._id;

    let updatedUser: any;

    if (isConnectedToMongoDB) {
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }
      if (name) user.name = name;
      if (image !== undefined) user.image = image;
      if (user.role === 'vendor' && businessName) user.businessName = businessName;
      await user.save();
      updatedUser = user;
    } else {
      const updates: any = {};
      if (name) updates.name = name;
      if (image !== undefined) updates.image = image;
      if (req.user.role === 'vendor' && businessName) updates.businessName = businessName;

      updatedUser = dbStore.updateUser(userId.toString(), updates);
      if (!updatedUser) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        image: updatedUser.image,
        role: updatedUser.role,
        businessName: updatedUser.businessName,
        subscriptionPlan: updatedUser.subscriptionPlan,
        isBlocked: updatedUser.isBlocked,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
