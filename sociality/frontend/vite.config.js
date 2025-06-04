import { defineConfig } from "vite";
import { pluginsConfig } from "./config/vite.plugins.js";
import { serverConfig } from "./config/vite.server.js";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: pluginsConfig,
	server: serverConfig,
});
