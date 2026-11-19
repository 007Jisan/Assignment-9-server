import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './models/User';
import { MenuItem } from './models/MenuItem';
import { Order } from './models/Order';
import { Transaction } from './models/Transaction';
import { Review } from './models/Review';

dotenv.config();

const seedDatabase = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizzahub';
    await mongoose.connect(uri);
    console.log('[Seed] Connected to database.');

    // Clear existing collections for a clean seed
    await Promise.all([
      User.deleteMany({}),
      MenuItem.deleteMany({}),
      Order.deleteMany({}),
      Transaction.deleteMany({}),
      Review.deleteMany({}),
    ]);
    console.log('[Seed] Cleared existing records.');

    // Password hashes
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', salt);
    const vendorPassword = await bcrypt.hash('Vendor@123456', salt);
    const customerPassword = await bcrypt.hash('Customer@123456', salt);

    // 1. Create Admin
    const admin = await User.create({
      name: 'PizzaHub Admin',
      email: (process.env.ADMIN_EMAIL || 'admin@pizzahub.com').toLowerCase(),
      password: adminPassword,
      role: 'admin',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      isBlocked: false,
      subscriptionPlan: 'free',
    });

    // 2. Create Vendors
    const vendor1 = await User.create({
      name: 'Luigi Rossi',
      email: 'luigi@pizzahub.com',
      password: vendorPassword,
      role: 'vendor',
      businessName: "Luigi's Authentic Wood-Fired Pizzeria",
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
      isBlocked: false,
      subscriptionPlan: 'premium',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const vendor2 = await User.create({
      name: 'Marco Bellini',
      email: 'marco@pizzahub.com',
      password: vendorPassword,
      role: 'vendor',
      businessName: 'Bella Napoli Artisan Pies',
      image: 'https://images.unsplash.com/photo-1583394293214-28ded15ee548?w=400',
      isBlocked: false,
      subscriptionPlan: 'free',
    });

    const vendor3 = await User.create({
      name: 'Elena Rostova',
      email: 'elena@pizzahub.com',
      password: vendorPassword,
      role: 'vendor',
      businessName: 'Fire & Dough Pizza Kitchen',
      image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400',
      isBlocked: false,
      subscriptionPlan: 'premium',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // 3. Create Customers
    const customer1 = await User.create({
      name: 'Alex Rivera',
      email: 'alex@gmail.com',
      password: customerPassword,
      role: 'customer',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
      isBlocked: false,
      subscriptionPlan: 'free',
    });

    const customer2 = await User.create({
      name: 'Sophia Chen',
      email: 'sophia@gmail.com',
      password: customerPassword,
      role: 'customer',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      isBlocked: false,
      subscriptionPlan: 'free',
    });

    console.log('[Seed] Users created: Admin, 3 Vendors, 2 Customers.');

    // 4. Create Menu Items
    const menuItemsData = [
      {
        vendorId: vendor1._id,
        itemName: 'Classic Neapolitan Margherita',
        category: 'Classic Pizzas',
        description: 'San Marzano tomato sauce, fresh mozzarella di bufala, fragrant sweet basil, extra virgin olive oil on a charred stone-baked crust.',
        price: 16.99,
        location: 'Downtown Brooklyn, NY',
        images: [
          'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800',
          'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
        ],
        status: 'approved',
        rating: 4.9,
        reviewCount: 28,
      },
      {
        vendorId: vendor1._id,
        itemName: 'Double Pepperoni Overload',
        category: 'Meat Lovers',
        description: 'Generous layers of spicy crispy cupping pepperoni, aged mozzarella, provolone blend, and house herb tomato passata.',
        price: 19.99,
        location: 'Downtown Brooklyn, NY',
        images: [
          'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800',
          'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=800',
        ],
        status: 'approved',
        rating: 4.8,
        reviewCount: 35,
      },
      {
        vendorId: vendor1._id,
        itemName: 'Black Truffle Wild Mushroom & Goat Cheese',
        category: 'Specialty / Gourmet Pizzas',
        description: 'Truffle-infused garlic cream sauce, roasted cremini, shiitake and oyster mushrooms, creamy chèvre goat cheese, and fresh thyme.',
        price: 24.5,
        location: 'Downtown Brooklyn, NY',
        images: [
          'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
          'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=800',
        ],
        status: 'approved',
        rating: 5.0,
        reviewCount: 19,
      },
      {
        vendorId: vendor2._id,
        itemName: 'Four Cheese Quattro Formaggi Gold',
        category: 'Classic Pizzas',
        description: 'Rich blend of creamy Taleggio, Gorgonzola Dolce, smoked provola, Parmigiano Reggiano, and hot honey drizzle.',
        price: 18.5,
        location: 'Manhattan Little Italy, NY',
        images: [
          'https://images.unsplash.com/photo-1573821663912-569905455b1c?w=800',
        ],
        status: 'approved',
        rating: 4.7,
        reviewCount: 14,
      },
      {
        vendorId: vendor2._id,
        itemName: 'Garden Harvest Primavera Special',
        category: 'Vegetarian Pizzas',
        description: 'Charred bell peppers, artichoke hearts, kalamata olives, red onions, heirloom cherry tomatoes, and vegan basil pesto.',
        price: 17.5,
        location: 'Manhattan Little Italy, NY',
        images: [
          'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=800',
        ],
        status: 'approved',
        rating: 4.6,
        reviewCount: 12,
      },
      {
        vendorId: vendor3._id,
        itemName: 'Smoky BBQ Chicken & Crispy Bacon',
        category: 'Meat Lovers',
        description: 'Hickory smoked pulled chicken, applewood smoked bacon, caramelized red onions, sharp cheddar blend, and smoky chipotle BBQ sauce.',
        price: 21.0,
        location: 'Queens Astoria, NY',
        images: [
          'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
        ],
        status: 'approved',
        rating: 4.9,
        reviewCount: 22,
      },
      {
        vendorId: vendor3._id,
        itemName: 'Prosciutto di Parma & Baby Arugula',
        category: 'Specialty / Gourmet Pizzas',
        description: '24-month aged Prosciutto di Parma, shaved Parmigiano-Reggiano, fresh peppery baby arugula, and Modena balsamic reduction.',
        price: 23.99,
        location: 'Queens Astoria, NY',
        images: [
          'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800',
        ],
        status: 'approved',
        rating: 4.9,
        reviewCount: 18,
      },
      {
        vendorId: vendor1._id,
        itemName: 'Garlic Butter Stuffed Dough Knots (6 pcs)',
        category: 'Sides & Appetizers',
        description: 'Fresh baked golden dough knots tossed in roasted garlic herb butter, grated Pecorino, served with warm marinara dipping sauce.',
        price: 8.99,
        location: 'Downtown Brooklyn, NY',
        images: [
          'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=800',
        ],
        status: 'approved',
        rating: 4.8,
        reviewCount: 31,
      },
      {
        vendorId: vendor2._id,
        itemName: 'Crispy Herbed Mozzarella Sticks',
        category: 'Sides & Appetizers',
        description: 'Hand-breaded golden mozzarella sticks with Italian herbs, served with homemade spicy arrabbiata dip.',
        price: 9.5,
        location: 'Manhattan Little Italy, NY',
        images: [
          'https://images.unsplash.com/photo-1531749668029-2db88e4276c7?w=800',
        ],
        status: 'approved',
        rating: 4.7,
        reviewCount: 16,
      },
      {
        vendorId: vendor3._id,
        itemName: 'Nutella S’mores Sweet Dessert Pizza',
        category: 'Beverages & Desserts',
        description: 'Warm thin crust smothered with rich Nutella hazelnut spread, toasted mini marshmallows, graham cracker crumble, and powdered sugar.',
        price: 12.99,
        location: 'Queens Astoria, NY',
        images: [
          'https://images.unsplash.com/photo-1528137871618-79d2761e3fd5?w=800',
        ],
        status: 'approved',
        rating: 5.0,
        reviewCount: 20,
      },
      {
        vendorId: vendor2._id,
        itemName: 'Italian Blood Orange & Lemon Sparkling Soda',
        category: 'Beverages & Desserts',
        description: 'Chilled authentic San Pellegrino Aranciata Rossa and Limonata artisan Italian sodas (330ml can).',
        price: 4.5,
        location: 'Manhattan Little Italy, NY',
        images: [
          'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800',
        ],
        status: 'approved',
        rating: 4.8,
        reviewCount: 9,
      },
      // 1 item in pending status to verify admin approval flow
      {
        vendorId: vendor2._id,
        itemName: 'Spicy Calabrian Chili & Honey Pie',
        category: 'Specialty / Gourmet Pizzas',
        description: 'Calabrian hot chili paste, soppressata, fresh fior di latte, hot honey drizzle, awaiting admin review.',
        price: 22.0,
        location: 'Manhattan Little Italy, NY',
        images: [
          'https://images.unsplash.com/photo-1544982503-9f984c14501a?w=800',
        ],
        status: 'pending',
        rating: 5.0,
        reviewCount: 0,
      },
    ];

    const insertedItems = await MenuItem.insertMany(menuItemsData);
    console.log(`[Seed] Created ${insertedItems.length} menu items.`);

    // 5. Create Sample Orders
    const order1 = await Order.create({
      itemId: insertedItems[0]._id,
      vendorId: vendor1._id,
      customerId: customer1._id,
      deliveryDate: '2026-11-20',
      deliveryAddress: '742 Evergreen Terrace, Brooklyn, NY 11201',
      message: 'Please leave the box on the porch table, ring bell twice.',
      status: 'accepted',
      statusTimeline: [
        {
          status: 'pending',
          timestamp: new Date(Date.now() - 3600000 * 2),
          note: 'Order placed by customer.',
        },
        {
          status: 'accepted',
          timestamp: new Date(Date.now() - 3600000),
          note: 'Order confirmed and oven heating by Luigi’s Pizzeria.',
        },
      ],
    });

    const order2 = await Order.create({
      itemId: insertedItems[1]._id,
      vendorId: vendor1._id,
      customerId: customer2._id,
      deliveryDate: '2026-11-21',
      deliveryAddress: '350 5th Ave, Manhattan, NY 10118',
      message: 'Extra napkins and extra crushed red peppers please!',
      status: 'pending',
      statusTimeline: [
        {
          status: 'pending',
          timestamp: new Date(),
          note: 'Order placed and waiting for restaurant confirmation.',
        },
      ],
    });

    console.log('[Seed] Created sample orders.');

    // 6. Create Sample Transactions for Premium Vendors
    await Transaction.create({
      vendorId: vendor1._id,
      plan: 'premium',
      amount: 19.99,
      currency: 'usd',
      stripeSessionId: 'cs_test_seed_session_001',
      status: 'succeeded',
    });

    await Transaction.create({
      vendorId: vendor3._id,
      plan: 'premium',
      amount: 19.99,
      currency: 'usd',
      stripeSessionId: 'cs_test_seed_session_002',
      status: 'succeeded',
    });

    console.log('[Seed] Created sample transactions.');

    // 7. Create Sample Reviews
    await Review.create({
      itemId: insertedItems[0]._id,
      userId: customer1._id,
      rating: 5,
      comment: 'The crust on this Margherita was heavenly! True authentic Neapolitan style. Will definitely reorder!',
    });

    await Review.create({
      itemId: insertedItems[1]._id,
      userId: customer2._id,
      rating: 5,
      comment: 'Hands down the best pepperoni pizza in town. Crisp cups with just the right spice kick!',
    });

    console.log('==================================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('Admin login:');
    console.log('  Email:    admin@pizzahub.com');
    console.log('  Password: Admin@123456');
    console.log('Vendor login:');
    console.log('  Email:    luigi@pizzahub.com');
    console.log('  Password: Vendor@123456');
    console.log('Customer login:');
    console.log('  Email:    alex@gmail.com');
    console.log('  Password: Customer@123456');
    console.log('==================================================');

    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  }
};

seedDatabase();
