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
 * Validate password with detailed result
 * Wrapper around isValidPassword that returns object with validation details
 * 
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, message?: string }
 */
function validatePassword(password) {
  if (!password || password.length < 6) {
    return {
      valid: false,
      message: 'Password must be at least 6 characters long'
    };
  }
  
  return { valid: true };
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
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required.');
  } else if (data.name.length > 255) {
    errors.push('Name must not exceed 255 characters.');
  }
  
  if (data.role && !['User', 'Admin'].includes(data.role)) {
    errors.push('Role must be either "User" or "Admin".');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate file upload
 * Checks file size, mime type, and extension against allowed values.
 * Protects against malicious uploads and directory traversal.
 * 
 * @param {Object} file - Multer file object
 * @returns {Object} { valid: boolean, error: string }
 */
function validateFileUpload(file) {
  // Get configuration from environment
  const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB) || 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  // Allowed MIME types for document processing
  const allowedMimeTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'text/csv'
  ];
  
  // Allowed file extensions (additional security layer)
  const allowedExtensions = ['.pdf', '.txt', '.md', '.docx', '.csv'];
  
  if (!file) {
    return { 
      valid: false, 
      error: 'No file provided. Please upload a file.' 
    };
  }
  
  // Check file size
  if (file.size === 0) {
    return { 
      valid: false, 
      error: 'File is empty. Please upload a file with content.' 
    };
  }
  
  if (file.size > maxSizeBytes) {
    return { 
      valid: false, 
      error: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of ${maxSizeMB} MB.` 
    };
  }
  
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: `File type '${file.mimetype}' is not supported. Allowed types: PDF, TXT, MD, DOCX, CSV.` 
    };
  }
  
  // Check file extension (additional security against MIME type spoofing)
  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
  if (!allowedExtensions.includes(fileExtension)) {
    return { 
      valid: false, 
      error: `File extension '${fileExtension}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}.` 
    };
  }
  
  // Check for directory traversal attempts in filename
  if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
    return { 
      valid: false, 
      error: 'Invalid filename. Filename must not contain path separators or parent directory references.' 
    };
  }
  
  // Check filename length
  if (file.originalname.length > 255) {
    return { 
      valid: false, 
      error: 'Filename is too long. Maximum length is 255 characters.' 
    };
  }
  
  return {
    valid: true,
    error: null
  };
}

export {
  isValidEmail,
  isValidPassword,
  validatePassword,
  validateRegistration,
  validateFileUpload
};

// Default export for backwards compatibility
export default {
  isValidEmail,
  isValidPassword,
  validatePassword,
  validateRegistration,
  validateFileUpload
};
