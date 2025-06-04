/**
 * Performance Utilities
 * Helper functions to improve application performance
 */

/**
 * Sets up a resize listener that temporarily disables all animations
 * during window resize to prevent layout thrashing and improve performance
 */
export const setupResizeAnimationStopper = () => {
  let resizeTimer;
  
  const handleResize = () => {
    // Add the class that disables animations
    document.body.classList.add('resize-animation-stopper');
    
    // Clear any existing timeout
    clearTimeout(resizeTimer);
    
    // Set a timeout to remove the class after resizing is complete
    resizeTimer = setTimeout(() => {
      document.body.classList.remove('resize-animation-stopper');
    }, 400);
  };
  
  // Add the event listener
  window.addEventListener('resize', handleResize);
  
  // Return a cleanup function
  return () => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(resizeTimer);
  };
};

/**
 * Debounce function to limit how often a function can be called
 * Useful for expensive operations like search filtering
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function to limit how often a function can be called
 * Useful for scroll and resize events
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};
