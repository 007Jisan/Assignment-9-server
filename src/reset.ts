import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User';
import { MenuItem } from './models/MenuItem';
import { Order } from './models/Order';
import { Transaction } from './models/Transaction';
import { Review } from './models/Review';
import { Favorite } from './models/Favorite';

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://jisan33info_db_user:T8wcKQ2lrAVuoQuw@cluster0.7s3g7la.mongodb.net/pizzahub?retryWrites=true&w=majority';

async function resetDatabase() {
  console.log('🔄 Connecting to MongoDB to reset database...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  console.log('🗑️  Wiping all collections...');
  await Promise.all([
    User.deleteMany({}),
    MenuItem.deleteMany({}),
    Order.deleteMany({}),
    Transaction.deleteMany({}),
    Review.deleteMany({}),
    Favorite.deleteMany({}),
  ]);

  console.log('✨ All collections have been completely reset to an empty clean state:');
  console.log('   - Users: 0');
  console.log('   - Menu Items: 0');
  console.log('   - Orders: 0');
  console.log('   - Transactions: 0');
  console.log('   - Reviews: 0');
  console.log('   - Favorites: 0');
  console.log('\n🚀 You can now create your own Admin, Vendor, and Customer accounts from http://localhost:3000/register!');
  console.log('   Admin Key: pizza-admin-2026\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
  process.exit(0);
}

resetDatabase().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
