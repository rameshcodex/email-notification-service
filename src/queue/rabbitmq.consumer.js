const amqp = require('amqplib');
const { sendEmailWithRetry } = require('../services/email.service');
const { validateQueueMessage } = require('../utils/validator');
const { logger } = require('../logger/logger');

let connection = null;
let channel = null;

async function connectToRabbitMQ() {
  const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  const queueName = process.env.RABBITMQ_QUEUE || 'email_queue';

  try {
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();

    await channel.assertQueue(queueName, {
      durable: true,
    });

    logger.info(`Connected to RabbitMQ. Listening on queue: ${queueName}`);

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
  const queueName = process.env.RABBITMQ_QUEUE || 'email_queue';

  if (!channel) {
    await connectToRabbitMQ();
  }

  channel.prefetch(10);

  channel.consume(queueName, async (msg) => {
    if (!msg) return;

    const rawContent = msg.content.toString();

    const { valid, parsed, errors } = validateQueueMessage(rawContent);

    if (!valid) {
      logger.error({ errors, rawContent }, 'Invalid queue message received');
      channel.ack(msg);
      return;
    }
    try {
      const result = await sendEmailWithRetry(parsed);

      if (result.success) {
        logger.info(
          { messageId: result.messageId, to: parsed.to },
          'Email sent successfully via queue'
        );
      } else {
        logger.error(
          { error: result.error, to: parsed.to },
          'Failed to send email via queue after retries'
        );
      }

      channel.ack(msg);
    } catch (err) {
      logger.error(
        { err: err.message || String(err), to: parsed.to },
        'Unexpected error processing queue message'
      );
      channel.ack(msg);
    }
  });

  logger.info(`Consumer started on queue: ${queueName}`);
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
