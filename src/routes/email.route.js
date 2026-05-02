const { validateEmailInput } = require('../utils/validator');
const { sendEmailWithRetry } = require('../services/email.service');
const { logger } = require('../logger/logger');

async function emailRoutes(fastify) {
  fastify.post('/send-email', async (request, reply) => {
    const { valid, errors } = validateEmailInput(request.body);

    if (!valid) {
      return reply.code(400).send({
        success: false,
        error: errors.join('; '),
      });
    }

    const { to, subject, emailContent } = request.body;

    try {
      const result = await sendEmailWithRetry({ to, subject, emailContent });

      if (result.success) {
        return reply.send({
          success: true,
          message: 'Email sent',
        });
      }

      return reply.code(502).send({
        success: false,
        error: result.error,
      });
    } catch (err) {
      logger.error({ err: err.message, to, subject }, 'Unexpected error in /send-email');

      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });
}

module.exports = emailRoutes;
