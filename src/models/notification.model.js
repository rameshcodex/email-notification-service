const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['LINK', 'MODAL', 'NONE'],
    default: 'NONE',
  },
  url: {
    type: String,
    trim: true,
  },
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: ['EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WEBHOOK'],
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'FAILED', 'DELIVERED', 'READ'],
    default: 'PENDING',
  },
  sentAt: {
    type: Date,
  },
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['TRADE', 'WALLET', 'SECURITY', 'SYSTEM'],
    index: true,
  },
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  priority: {
    type: String,
    required: true,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
  action: {
    type: actionSchema,
    default: { type: 'NONE' },
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  deliveries: {
    type: [deliverySchema],
    default: [],
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  expiresAt: {
    type: Date,
    index: true,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ category: 1, priority: 1 });
notificationSchema.index({ isRead: 1, createdAt: -1 });

notificationSchema.methods.markAsRead = async function () {
  this.isRead = true;
  return this.save();
};

notificationSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Notification', notificationSchema);
