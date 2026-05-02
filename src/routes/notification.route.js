const {
  createNotification,
  getNotificationsByUser,
  markAsRead,
  markAllAsRead,
} = require('../services/notification.service');

async function notificationRoutes(fastify) {
  fastify.post('/notifications', async (request, reply) => {
    const { userId, category, eventType, title, message, priority, action, data } = request.body;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return reply.code(400).send({
        success: false,
        error: 'userId is required',
      });
    }

    const validCategories = ['TRADE', 'WALLET', 'SECURITY', 'SYSTEM'];
    if (!category || !validCategories.includes(category)) {
      return reply.code(400).send({
        success: false,
        error: `category is required and must be one of: ${validCategories.join(', ')}`,
      });
    }

    if (!eventType || typeof eventType !== 'string' || eventType.trim() === '') {
      return reply.code(400).send({
        success: false,
        error: 'eventType is required',
      });
    }

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return reply.code(400).send({
        success: false,
        error: 'title is required',
      });
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return reply.code(400).send({
        success: false,
        error: 'message is required',
      });
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!priority || !validPriorities.includes(priority)) {
      return reply.code(400).send({
        success: false,
        error: `priority is required and must be one of: ${validPriorities.join(', ')}`,
      });
    }

    if (action) {
      const validActionTypes = ['LINK', 'MODAL', 'NONE'];
      if (action.type && !validActionTypes.includes(action.type)) {
        return reply.code(400).send({
          success: false,
          error: `action.type must be one of: ${validActionTypes.join(', ')}`,
        });
      }
    }

    try {
      const notification = await createNotification({
        userId: userId.trim(),
        category,
        eventType: eventType.trim(),
        title: title.trim(),
        message: message.trim(),
        priority,
        action,
        data,
      });

      return reply.code(201).send({
        success: true,
        data: notification,
      });
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message,
      });
    }
  });

  fastify.get('/notifications', async (request, reply) => {
    const { userId } = request.query;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return reply.code(400).send({
        success: false,
        error: 'userId query parameter is required',
      });
    }

    try {
      const result = await getNotificationsByUser(userId.trim(), {
        page: request.query.page,
        limit: request.query.limit,
        isRead: request.query.isRead === 'true' ? true : request.query.isRead === 'false' ? false : undefined,
        category: request.query.category,
        priority: request.query.priority,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
      });

      return reply.send({
        success: true,
        pagination: {
          currentPage: result.currentPage,
          totalPages: result.totalPages,
          total: result.total,
          perPage: result.perPage,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
          nextPage: result.nextPage || null,
          prevPage: result.prevPage || null,
        },
        unreadCount: result.unreadCount,
        groupedByDate: result.groupedByDate,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  fastify.patch('/notifications/:id/read', async (request, reply) => {
    const { id } = request.params;
    const { userId } = request.body;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return reply.code(400).send({
        success: false,
        error: 'userId is required in request body',
      });
    }

    try {
      const notification = await markAsRead(id, userId.trim());

      return reply.send({
        success: true,
        data: notification,
      });
    } catch (err) {
      if (err.message === 'Notification not found') {
        return reply.code(404).send({
          success: false,
          error: err.message,
        });
      }

      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });

  fastify.patch('/notifications/read-all', async (request, reply) => {
    const { userId } = request.body;

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return reply.code(400).send({
        success: false,
        error: 'userId is required in request body',
      });
    }

    try {
      const result = await markAllAsRead(userId.trim());

      return reply.send({
        success: true,
        data: result,
        message: `${result.modifiedCount} notifications marked as read`,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  });
}

module.exports = notificationRoutes;
