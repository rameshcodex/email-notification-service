const amqp = require('amqplib');
const { createNotification } = require('../services/notification.service');
const { logger } = require('../logger/logger');

let connection = null;
let channel = null;

async function connectToRabbitMQ() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
  const queueName = process.env.NOTIFICATION_QUEUE || 'notification_queue';

  try {
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();

    await channel.assertQueue(queueName, {
      durable: true,
    });

    logger.info({ queue: queueName }, 'Connected to RabbitMQ. Listening on queue');

    connection.on('error', (err) => {
      logger.error({ err: err.message }, 'RabbitMQ connection error');
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
    });

    return { connection, channel };
  } catch (err) {
    logger.error({ err: err.message || String(err) }, 'Failed to connect to RabbitMQ');
    throw err;
  }
}

async function startConsumer() {
  const queueName = process.env.NOTIFICATION_QUEUE || 'notification_queue';

  if (!channel) {
    await connectToRabbitMQ();
  }

  channel.prefetch(10);

  channel.consume(queueName, async (msg) => {
    if (!msg) return;

    const rawContent = msg.content.toString();

    try {
      const parsed = JSON.parse(rawContent);

      if (!parsed || typeof parsed !== 'object') {
        logger.error({ rawContent }, 'Invalid notification message format');
        channel.ack(msg);
        return;
      }

      const { userId, category, eventType, title, message, priority, action, data } = parsed;

      if (!userId || !category || !eventType || !title || !message) {
        logger.error({ userId, category, eventType }, 'Missing required fields in notification message');
        channel.ack(msg);
        return;
      }

      await createNotification({
        userId,
        category,
        eventType,
        title,
        message,
        priority: priority || 'MEDIUM',
        action: action || { type: 'NONE' },
        data: data || {},
      });

      channel.ack(msg);
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to process notification message');
      channel.ack(msg);
    }
  });

  logger.info({ queue: queueName }, 'Notification consumer started on queue');
}

async function closeConnection() {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    if (connection) {
      await connection.close();
      connection = null;
    }
    logger.info('RabbitMQ connection closed gracefully');
  } catch (err) {
    logger.error({ err: err.message }, 'Error closing RabbitMQ connection');
  }
}

module.exports = {
  connectToRabbitMQ,
  startConsumer,
  closeConnection,
};
