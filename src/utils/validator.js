function validateEmailInput(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const { to, subject, emailContent } = body;

  if (!to || typeof to !== 'string' || to.trim() === '') {
    errors.push('"to" is required and must be a non-empty string');
  } else if (!isValidEmail(to.trim())) {
    errors.push('"to" must be a valid email address');
  }

  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    errors.push('"subject" is required and must be a non-empty string');
  } else if (subject.trim().length > 200) {
    errors.push('"subject" must not exceed 200 characters');
  }

  if (!emailContent || typeof emailContent !== 'string' || emailContent.trim() === '') {
    errors.push('"emailContent" is required and must be a non-empty string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateQueueMessage(rawMessage) {
  try {
    const parsed = JSON.parse(rawMessage);

    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, parsed: null, errors: ['Invalid message format'] };
    }

    const { to, subject, emailContent } = parsed;

    if (!to || typeof to !== 'string' || to.trim() === '') {
      return { valid: false, parsed: null, errors: ['"to" field is required'] };
    }

    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      return { valid: false, parsed: null, errors: ['"subject" field is required'] };
    }

    if (!emailContent || typeof emailContent !== 'string' || emailContent.trim() === '') {
      return { valid: false, parsed: null, errors: ['"emailContent" field is required'] };
    }

    return {
      valid: true,
      parsed: {
        to: to.trim(),
        subject: subject.trim(),
        emailContent: emailContent.trim(),
      },
      errors: [],
    };
  } catch (err) {
    return {
      valid: false,
      parsed: null,
      errors: ['Failed to parse message as JSON'],
    };
  }
}

module.exports = {
  validateEmailInput,
  validateQueueMessage,
};
