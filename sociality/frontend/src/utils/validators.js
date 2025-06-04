/**
 * Validation utilities
 * Contains helper functions for validating data
 */

/**
 * Validate an email address
 * @param {string} email - The email to validate
 * @returns {boolean} - Whether the email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate a password
 * @param {string} password - The password to validate
 * @returns {boolean} - Whether the password is valid
 */
export const isValidPassword = (password) => {
  // At least 8 characters, at least one letter and one number
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Validate a username
 * @param {string} username - The username to validate
 * @returns {boolean} - Whether the username is valid
 */
export const isValidUsername = (username) => {
  // 3-20 characters, letters, numbers, underscores, and hyphens
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

/**
 * Validate a file size
 * @param {File} file - The file to validate
 * @param {number} maxSizeMB - The maximum size in MB
 * @returns {boolean} - Whether the file size is valid
 */
export const isValidFileSize = (file, maxSizeMB = 5) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Validate a file type
 * @param {File} file - The file to validate
 * @param {string[]} allowedTypes - The allowed MIME types
 * @returns {boolean} - Whether the file type is valid
 */
export const isValidFileType = (file, allowedTypes = ['image/jpeg', 'image/png', 'image/gif']) => {
  return allowedTypes.includes(file.type);
};
