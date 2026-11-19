import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { verifyToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

const signToken = (id: string, role: string) => {
  const secret = process.env.JWT_SECRET || 'pizzahub_jwt_secret_dev_key_secure_2026_9999';
  return jwt.sign({ id, role }, secret, { expiresIn: '7d' });
};

// POST /api/auth/register
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

    // Password validation: min 6 chars, 1 uppercase, 1 lowercase
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/;
    if (!passwordRegex.test(password)) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters and include at least one uppercase and one lowercase letter.',
      });
      return;
    }

    // Check existing email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Email already registered. Please sign in.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      image: image || '',
      role,
      businessName: role === 'vendor' ? businessName || `${name}'s Pizzeria` : undefined,
      subscriptionPlan: 'free',
      isBlocked: false,
    });

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
      message: 'Account created successfully!',
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password.' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
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

// POST /api/auth/google
router.post('/google', async (req, res, next) => {
  try {
    const { email, name, image, role = 'customer' } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required from Google auth.' });
      return;
    }

    let user = await User.findOne({ email: email.toLowerCase() });

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

// GET /api/auth/me
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

// PUT /api/auth/profile
router.put('/profile', verifyToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, image, businessName } = req.body;
    const userId = req.user!._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Role and subscriptionPlan CANNOT be changed by user
    if (name) user.name = name;
    if (image !== undefined) user.image = image;
    if (user.role === 'vendor' && businessName) user.businessName = businessName;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        businessName: user.businessName,
        subscriptionPlan: user.subscriptionPlan,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
