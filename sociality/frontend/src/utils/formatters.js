/**
 * Formatting utilities
 * Contains helper functions for formatting data
 */

/**
 * Format a date to a relative time string (e.g., "2 hours ago")
 * @param {string|Date} date - The date to format
 * @returns {string} - The formatted relative time
 */
export const formatRelativeTime = (date) => {
  const now = new Date();
  const postDate = new Date(date);
  const diffInSeconds = Math.floor((now - postDate) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  
  return postDate.toLocaleDateString();
};

/**
 * Format a number to a compact string (e.g., "1.2K")
 * @param {number} num - The number to format
 * @returns {string} - The formatted number
 */
export const formatCompactNumber = (num) => {
  if (num < 1000) {
    return num.toString();
  }
  
  if (num < 1000000) {
    return `${(num / 1000).toFixed(1)}K`.replace('.0K', 'K');
  }
  
  return `${(num / 1000000).toFixed(1)}M`.replace('.0M', 'M');
};
