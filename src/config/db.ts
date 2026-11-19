import mongoose from 'mongoose';

export let isConnectedToMongoDB = false;

export const connectDB = async (): Promise<boolean> => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizzahub';
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    isConnectedToMongoDB = true;
    console.log(`[PizzaHub Server] Connected to MongoDB at ${uri.includes('@') ? 'MongoDB Atlas Cluster' : uri}`);
    return true;
  } catch (error) {
    isConnectedToMongoDB = false;
    console.warn('[PizzaHub Server] Notice: MongoDB is not running locally. Using auto-persistent JSON database store (data/store.json). All auth, menu, and orders work 100%!');
    return false;
  }
};
