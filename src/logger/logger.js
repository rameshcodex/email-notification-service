const pino = require('pino');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const emailLogDest = fs.createWriteStream(path.join(logDir, 'email.log'), { flags: 'a' });

const emailLogger = pino(
  {
    level: 'info',
    base: null,
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  },
  emailLogDest
);

const appLogDest = pino.destination({
  dest: path.join(logDir, 'app.log'),
  sync: false,
  mkdir: true,
});

const appStreams = [{ stream: appLogDest, level: process.env.LOG_LEVEL || 'info' }];

if (process.env.NODE_ENV !== 'production') {
  appStreams.push({
    stream: pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }),
    level: process.env.LOG_LEVEL || 'info',
  });
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream(appStreams)
);

function logEmailResult({ to, subject, status, reason = null }) {
  emailLogger.info({
    // time: new Date().toISOString(),
    to,
    subject,
    status,
    reason,
  });
}

module.exports = {
  logger,
  logEmailResult,
};
