require('dotenv').config();

const fastify = require('fastify')({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
        : undefined,
  },
});

const connectDB = require('./config/db');
const { verifySmtpConnection } = require('./services/email.service');
const { startConsumer: startEmailConsumer, closeConnection: closeEmailConnection } = require('./queue/rabbitmq.consumer');
const { startConsumer: startNotificationConsumer, closeConnection: closeNotificationConnection } = require('./queue/notification.consumer');
const { logger } = require('./logger/logger');
const emailRoutes = require('./routes/email.route');
const notificationRoutes = require('./routes/notification.route');

fastify.register(require('@fastify/sensible'));

fastify.register(emailRoutes);
fastify.register(notificationRoutes);

fastify.get('/health', async (request, reply) => {
  const smtpCheck = await verifySmtpConnection();
  const mongoState = require('mongoose').connection.readyState;

  return reply.send({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    smtp: smtpCheck.connected ? 'connected' : 'disconnected',
    mongo: mongoState === 1 ? 'connected' : 'disconnected',
  });
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`${signal} received. Starting graceful shutdown...`);

  try {
    await fastify.close();
    logger.info('HTTP server closed');

    await closeEmailConnection();
    logger.info('Email RabbitMQ connection closed');

    await closeNotificationConnection();
    logger.info('Notification RabbitMQ connection closed');

    await require('mongoose').connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error({ err: err.message }, 'Error during graceful shutdown');
  }

  process.exitCode = 0;
}

process.on('uncaughtException', (err) => {
  if (shuttingDown) {
    process.exit(1);
  }
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  if (shuttingDown) return;
  logger.error({ reason: String(reason) }, 'Unhandled rejection');
});

async function start() {
  try {
    await connectDB();

    const port = parseInt(process.env.PORT, 10) || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    logger.info(`Server listening on http://${host}:${port}`);

    try {
      await startEmailConsumer();
      logger.info('Email RabbitMQ consumer started');
    } catch (err) {
      logger.warn(
        { err: err.message },
        'Failed to start Email RabbitMQ consumer. API will still work.'
      );
    }

    try {
      await startNotificationConsumer();
      logger.info('Notification RabbitMQ consumer started');
    } catch (err) {
      logger.warn(
        { err: err.message },
        'Failed to start Notification RabbitMQ consumer. API will still work.'
      );
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to start server');
    process.exit(1);
  }
}

start();

module.exports = fastify;
