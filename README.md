# Email & Notification Microservice

A production-ready microservice built with **Fastify** that handles **email sending** and **notification management** via REST APIs and RabbitMQ message queues.

---

## Quick Start

```bash
cp .env.example .env
npm install
npm start
```

Server runs at `http://localhost:3500` by default.

---

## Environment Variables

```env
PORT=3500
MONGO_URI=mongodb://127.0.0.1:27017/notification_db
RABBITMQ_URL=amqp://lucky:123456@localhost:5672
RABBITMQ_QUEUE=email_queue
NOTIFICATION_QUEUE=notification_queue
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
EMAIL_FROM_NAME=Your Service
EMAIL_FROM_ADDRESS=noreply@example.com
LOG_LEVEL=info
```

---

## API Endpoints

### 1. Send Email

**POST** `/send-email`

Sends an email via SMTP. Retries up to 3 times on failure.

**Request Body:**

```json
{
  "to": "user@example.com",
  "subject": "Welcome to our platform",
  "emailContent": "<h1>Hello!</h1><p>Your account is ready.</p>"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Email sent"
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "\"to\" must be a valid email address"
}
```

---

### 2. Create Notification

**POST** `/notifications`

Creates a notification in MongoDB.

**Request Body:**

```json
{
  "userId": "user_123",
  "category": "TRADE",
  "eventType": "ORDER_FILLED",
  "title": "Order Completed",
  "message": "Your order #456 has been filled successfully",
  "priority": "HIGH",
  "action": {
    "type": "LINK",
    "url": "https://example.com/orders/456"
  },
  "data": {
    "orderId": "456",
    "amount": 150.00
  }
}
```

**Allowed Values:**
- `category`: `TRADE` | `WALLET` | `SECURITY` | `SYSTEM`
- `priority`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
- `action.type`: `LINK` | `MODAL` | `NONE`

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "user_123",
    "category": "TRADE",
    "eventType": "ORDER_FILLED",
    "title": "Order Completed",
    "message": "Your order #456 has been filled successfully",
    "priority": "HIGH",
    "action": { "type": "LINK", "url": "https://example.com/orders/456" },
    "data": { "orderId": "456", "amount": 150 },
    "isRead": false,
    "createdAt": "2026-05-02T12:00:00.000Z",
    "updatedAt": "2026-05-02T12:00:00.000Z"
  }
}
```

---

### 3. Get Notifications (with filters & pagination)

**GET** `/notifications`

Fetches notifications for a user, grouped by date, with pagination.

**Query Parameters:**

| Parameter   | Type    | Required | Description                              |
|-------------|---------|----------|------------------------------------------|
| `userId`    | string  | Yes      | User ID to filter notifications          |
| `page`      | number  | No       | Page number (default: 1)                 |
| `limit`     | number  | No       | Items per page (default: 20)             |
| `isRead`    | string  | No       | `"true"` or `"false"` to filter read status |
| `category`  | string  | No       | Filter by `TRADE`, `WALLET`, `SECURITY`, `SYSTEM` |
| `priority`  | string  | No       | Filter by `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `startDate` | string  | No       | Filter from date (ISO format)            |
| `endDate`   | string  | No       | Filter to date (ISO format)              |

**Examples:**

```
GET /notifications?userId=user_123
GET /notifications?userId=user_123&isRead=false&page=2&limit=10
GET /notifications?userId=user_123&category=TRADE&priority=HIGH
GET /notifications?userId=user_123&startDate=2026-05-01&endDate=2026-05-02
```

**Success Response (200):**

```json
{
  "success": true,
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "total": 50,
    "perPage": 20,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  },
  "unreadCount": 12,
  "groupedByDate": [
    {
      "date": "2026-05-02",
      "count": 8,
      "notifications": [
        {
          "_id": "...",
          "userId": "user_123",
          "category": "TRADE",
          "title": "Order Completed",
          "message": "Your order has been filled",
          "priority": "HIGH",
          "isRead": false,
          "createdAt": "2026-05-02T12:00:00.000Z"
        }
      ]
    },
    {
      "date": "2026-05-01",
      "count": 12,
      "notifications": []
    }
  ]
}
```

---

### 4. Mark Single Notification as Read

**PATCH** `/notifications/:id/read`

**Request Body:**

```json
{
  "userId": "user_123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "_id": "...",
    "userId": "user_123",
    "isRead": true
  }
}
```

**Not Found Response (404):**

```json
{
  "success": false,
  "error": "Notification not found"
}
```

---

### 5. Mark All Notifications as Read

**PATCH** `/notifications/read-all`

**Request Body:**

```json
{
  "userId": "user_123"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "matchedCount": 12,
    "modifiedCount": 12
  },
  "message": "12 notifications marked as read"
}
```

---

### 6. Health Check

**GET** `/health`

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-05-02T12:00:00.000Z",
  "smtp": "connected",
  "mongo": "connected"
}
```

---

## RabbitMQ Integration

### How It Works

The service listens on two queues:

| Queue Name             | Purpose                        |
|------------------------|--------------------------------|
| `email_queue`          | Receives messages to send email |
| `notification_queue`   | Receives messages to save notification |

When a message arrives, the service processes it automatically and acknowledges the message.

---

### How to Publish Messages

#### Option A: Using Node.js (amqplib)

**Send Email via Queue:**

```js
const amqp = require('amqplib');

async function publishEmailEvent() {
  const connection = await amqp.connect('amqp://lucky:123456@localhost:5672');
  const channel = await connection.createChannel();

  const message = {
    to: "user@example.com",
    subject: "Welcome!",
    emailContent: "<h1>Hello!</h1><p>Your account is ready.</p>"
  };

  channel.sendToQueue('email_queue', Buffer.from(JSON.stringify(message)), {
    persistent: true
  });

  console.log('Email event published');
  await connection.close();
}

publishEmailEvent();
```

**Send Notification via Queue:**

```js
const amqp = require('amqplib');

async function publishNotificationEvent() {
  const connection = await amqp.connect('amqp://lucky:123456@localhost:5672');
  const channel = await connection.createChannel();

  const message = {
    userId: "user_123",
    category: "TRADE",
    eventType: "ORDER_FILLED",
    title: "Order Completed",
    message: "Your order #456 has been filled successfully",
    priority: "HIGH",
    action: {
      type: "LINK",
      url: "https://example.com/orders/456"
    },
    data: {
      orderId: "456",
      amount: 150.00
    }
  };

  channel.sendToQueue('notification_queue', Buffer.from(JSON.stringify(message)), {
    persistent: true
  });

  console.log('Notification event published');
  await connection.close();
}

publishNotificationEvent();
```

---

#### Option B: Using RabbitMQ Management UI

1. Open `http://localhost:15672` in your browser
2. Login with your RabbitMQ credentials
3. Go to **Queues** → click on `email_queue` or `notification_queue`
4. Click **Publish message**
5. Set **Payload** to your JSON message
6. Click **Publish**

---

#### Option C: Using curl (with rabbitmqadmin)

```bash
# Publish to email queue
rabbitmqadmin publish routing_key=email_queue payload='{"to":"user@example.com","subject":"Test","emailContent":"<h1>Hello</h1>"}'

# Publish to notification queue
rabbitmqadmin publish routing_key=notification_queue payload='{"userId":"user_123","category":"TRADE","eventType":"ORDER_FILLED","title":"Order Done","message":"Your order is filled","priority":"HIGH"}'
```

---

## Project Structure

```
src/
├── config/
│   └── db.js                      # MongoDB connection
├── logger/
│   └── logger.js                  # Pino logger (app logs + email logs)
├── models/
│   └── notification.model.js      # Notification schema + pagination
├── queue/
│   ├── rabbitmq.consumer.js       # Email queue consumer
│   └── notification.consumer.js   # Notification queue consumer
├── routes/
│   ├── email.route.js             # POST /send-email
│   └── notification.route.js      # Notification CRUD endpoints
├── services/
│   ├── email.service.js           # Email sending logic with retry
│   └── notification.service.js    # Notification DB operations
├── utils/
│   └── validator.js               # Input validation
└── server.js                      # Fastify server entry point

logs/
├── email.log                      # Email delivery status only (JSON)
└── app.log                        # Application logs
```

---

## Logs

### Email Logs (`logs/email.log`)

Only email delivery status in strict JSON format:

```json
{"time":"2026-05-02T12:00:00.000Z","to":"user@example.com","subject":"Welcome","status":"SUCCESS","reason":null}
{"time":"2026-05-02T12:01:00.000Z","to":"user@example.com","subject":"Alert","status":"FAILURE","reason":"Connection refused"}
```

### App Logs (`logs/app.log`)

All other logs: server startup, MongoDB connection, RabbitMQ events, errors, etc.
