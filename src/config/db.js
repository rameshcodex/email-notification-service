const mongoose = require('mongoose');
const { logger } = require('../logger/logger');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    logger.error('MONGO_URI environment variable is not set');
    process.exit(1);
  }

  mongoose.connection.on('connected', () => {
    logger.info({ uri: mongoUri.replace(/\/\/.*@/, '//***:***@') }, 'MongoDB Connected');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB Disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error({ err: err.message, code: err.code, name: err.name }, 'MongoDB Connection Error');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB Reconnected');
  });

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    logger.info(
      {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        readyState: mongoose.connection.readyState,
      },
      'MongoDB Connected Successfully'
    );
  } catch (err) {
    logger.error(
      {
        err: err.message,
        code: err.code,
        name: err.name,
        uri: mongoUri.replace(/\/\/.*@/, '//***:***@'),
      },
      'MongoDB Connection Failed'
    );
    process.exit(1);
  }
};

module.exports = connectDB;
