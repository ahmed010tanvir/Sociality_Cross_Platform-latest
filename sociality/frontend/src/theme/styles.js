/**
 * Global styles configuration
 * Contains global style definitions for the application
 * Forced to dark mode only - no light mode support
 */
export const styles = {
  global: () => ({
    body: {
      color: "whiteAlpha.900", // Always use dark mode text color
      bg: "#101010", // Always use dark mode background - matches chat interface
      margin: 0,
      padding: 0,
    },
    html: {
      margin: 0,
      padding: 0,
    },
  }),
};
