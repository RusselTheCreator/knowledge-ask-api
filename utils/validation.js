/**
 * utils/validation.js
 * Input validation utility functions.
 */

/**
 * Validate email format using a simple regex
 * 
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Password must be at least 8 characters long and contain:
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 * 
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidPassword(password) {
  if (password.length < 8) {
    return false;
  }
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return hasUppercase && hasLowercase && hasDigit && hasSpecial;
}

/**
 * Validate user registration data
 * 
 * @param {Object} data - Registration data { email, password, role? }
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateRegistration(data) {
  const errors = [];
  
  if (!data.email) {
    errors.push('Email is required.');
  } else if (!isValidEmail(data.email)) {
    errors.push('Invalid email format.');
  }
  
  if (!data.password) {
    errors.push('Password is required.');
  } else if (!isValidPassword(data.password)) {
    errors.push('Password must be at least 8 characters long and contain uppercase, lowercase, digit, and special character.');
  }
  
  if (data.role && !['user', 'admin'].includes(data.role)) {
    errors.push('Role must be either "user" or "admin".');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate file upload
 * Checks file size and mime type against allowed values.
 * 
 * @param {Object} file - Multer file object
 * @param {number} maxSizeBytes - Maximum file size in bytes
 * @param {string[]} allowedMimeTypes - Array of allowed MIME types
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateFileUpload(file, maxSizeBytes, allowedMimeTypes) {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided.');
    return { valid: false, errors };
  }
  
  if (file.size > maxSizeBytes) {
    errors.push(`File size exceeds maximum allowed size of ${maxSizeBytes / (1024 * 1024)} MB.`);
  }
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(', ')}.`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  isValidEmail,
  isValidPassword,
  validateRegistration,
  validateFileUpload
};
