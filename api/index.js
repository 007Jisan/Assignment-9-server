const appModule = require('../dist/app');
const app = appModule.default || appModule;
const { connectDB } = require('../dist/config/db');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Database connection error in Vercel handler:', err);
  }
  return app(req, res);
};
