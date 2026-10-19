const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lakhpati';
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 20000,
  });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};
