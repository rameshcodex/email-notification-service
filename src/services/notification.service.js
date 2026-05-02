const Notification = require('../models/notification.model');

const REQUIRED_FIELDS = ['userId', 'category', 'eventType', 'title', 'message', 'priority'];

async function createNotification(payload) {
  const missingFields = REQUIRED_FIELDS.filter((field) => !payload[field]);

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  const validCategories = ['TRADE', 'WALLET', 'SECURITY', 'SYSTEM'];
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const validActionTypes = ['LINK', 'MODAL', 'NONE'];

  if (!validCategories.includes(payload.category)) {
    throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  if (!validPriorities.includes(payload.priority)) {
    throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
  }

  if (payload.action && payload.action.type && !validActionTypes.includes(payload.action.type)) {
    throw new Error(`Invalid action type. Must be one of: ${validActionTypes.join(', ')}`);
  }

  const notification = new Notification({
    userId: payload.userId,
    category: payload.category,
    eventType: payload.eventType,
    title: payload.title,
    message: payload.message,
    priority: payload.priority,
    action: payload.action || { type: 'NONE' },
    data: payload.data || {},
    deliveries: payload.deliveries || [],
    expiresAt: payload.expiresAt || null,
  });

  const savedNotification = await notification.save();

  return savedNotification;
}

async function getNotificationsByUser(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    isRead,
    category,
    priority,
    startDate,
    endDate,
  } = options;

  const query = { userId };

  if (typeof isRead === 'boolean') query.isRead = isRead;
  if (category) query.category = category;
  if (priority) query.priority = priority;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const result = await Notification.paginate(query, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 },
    select: '-__v',
    lean: true,
    customLabels: {
      totalDocs: 'total',
      docs: 'notifications',
      page: 'currentPage',
      totalPages: 'totalPages',
      limit: 'perPage',
      hasNextPage: 'hasNext',
      hasPrevPage: 'hasPrev',
      nextPage: 'nextPage',
      prevPage: 'prevPage',
    },
  });

  const groupedByDate = {};

  result.notifications.forEach((notification) => {
    const dateKey = new Date(notification.createdAt).toISOString().split('T')[0];
    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(notification);
  });

  const groupedNotifications = Object.entries(groupedByDate).map(([date, notifications]) => ({
    date,
    notifications,
    count: notifications.length,
  }));

  return {
    ...result,
    groupedByDate: groupedNotifications,
    unreadCount: await Notification.countDocuments({ userId, isRead: false }),
  };
}

async function markAsRead(notificationId, userId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new Error('Notification not found');
  }

  return notification;
}

async function markAllAsRead(userId) {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );

  return {
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  };
}

module.exports = {
  createNotification,
  getNotificationsByUser,
  markAsRead,
  markAllAsRead,
};
