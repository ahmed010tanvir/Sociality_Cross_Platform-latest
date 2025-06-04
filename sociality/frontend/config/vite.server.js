/**
 * Vite server configuration
 * Contains server-specific settings like port, proxy, and filesystem options
 */
export const serverConfig = {
  port: 7100,
  // Get rid of the CORS error
  proxy: {
    "/api": {
      target: "http://localhost:5000", // Change this to your actual backend port
      changeOrigin: true,
      secure: false,
      configure: (proxy, options) => {
        proxy.on('error', (err, req, res) => {
          // Only log proxy errors, not all requests
          console.error('Proxy error:', err.message);
        });
      },
    },
    "/socket.io": {
      target: "http://localhost:5000",
      changeOrigin: true,
      secure: false,
      ws: true, // Enable WebSocket proxying
    },
  },
  // Allow serving files from one level up to the project root
  fs: {
    allow: ["../.."],
  },
};
