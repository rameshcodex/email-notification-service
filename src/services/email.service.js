const nodemailer = require('nodemailer');
const { logEmailResult } = require('../logger/logger');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: parseInt(process.env.SMTP_PORT, 10) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
}

async function verifySmtpConnection() {
  const transport = getTransporter();
  try {
    await transport.verify();
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function sendEmail({ to, subject, emailContent }) {
  const transport = getTransporter();

  const mailOptions = {
    from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
    to: to.trim(),
    subject: subject.trim(),
    html: emailContent.trim(),
    text: emailContent.trim().replace(/<[^>]*>/g, ''),
  };

  try {
    const info = await transport.sendMail(mailOptions);

    logEmailResult({
      to: to.trim(),
      subject: subject.trim(),
      status: 'SUCCESS',
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    logEmailResult({
      to: to.trim(),
      subject: subject.trim(),
      status: 'FAILURE',
      reason: err.message,
    });

    return {
      success: false,
      error: err.message,
    };
  }
}

async function sendEmailWithRetry({ to, subject, emailContent }, retries = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await sendEmail({ to, subject, emailContent });

    if (result.success) {
      return result;
    }

    lastError = result.error;

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return {
    success: false,
    error: `Failed after ${retries} attempts. Last error: ${lastError}`,
  };
}

module.exports = {
  sendEmail,
  sendEmailWithRetry,
  verifySmtpConnection,
};
