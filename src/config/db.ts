import mongoose from 'mongoose';
import dns from 'dns';

export let isConnectedToMongoDB = false;

export const connectDB = async (): Promise<boolean> => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizzahub';
  const isAtlas = uri.startsWith('mongodb+srv://') || uri.includes('@');

  if (isAtlas) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {
      // Ignore if DNS server configuration is restricted
    }
  }

  try {
    console.log(`[PizzaHub Server] Attempting connection to ${isAtlas ? 'MongoDB Atlas Cloud' : 'local MongoDB'}...`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: isAtlas ? 12000 : 2500,
    });
    isConnectedToMongoDB = true;
    console.log(`[PizzaHub Server] ✅ Connected successfully to MongoDB at ${isAtlas ? 'MongoDB Atlas Cloud Database' : uri}`);
    return true;
  } catch (error: any) {
    isConnectedToMongoDB = false;
    if (isAtlas) {
      console.error(`[PizzaHub Server] ❌ Failed to connect to MongoDB Atlas: ${error.message}`);
      if (error.message?.includes('whitelist') || error.message?.includes('querySrv ETIMEOUT')) {
        console.warn(`[PizzaHub Server] ⚠️ Hint: Please ensure your IP address (or 0.0.0.0/0) is whitelisted in MongoDB Atlas Network Access.`);
      } else if (error.message?.includes('bad auth') || error.message?.includes('Authentication failed')) {
        console.warn(`[PizzaHub Server] ⚠️ Hint: Please verify your Atlas username, password, and database name in MONGODB_URI.`);
      }
    } else {
      console.warn('[PizzaHub Server] Notice: MongoDB is not running locally. Using auto-persistent JSON database store (data/store.json).');
    }
    return false;
  }
};
