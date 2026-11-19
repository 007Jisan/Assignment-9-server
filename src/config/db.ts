import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizzahub';
    await mongoose.connect(uri);
    console.log(`[PizzaHub Server] Connected to MongoDB at ${uri.includes('@') ? 'MongoDB Atlas Cluster' : uri}`);
  } catch (error) {
    console.error('[PizzaHub Server] MongoDB connection error:', error);
  }
};
