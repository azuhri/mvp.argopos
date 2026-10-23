import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { localFrontendOrigin } from "./vite/localFrontendOrigin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://103.154.215.122:3010/backend/celestia",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  base: '/',
  plugins: [
    localFrontendOrigin(loadEnv(mode, __dirname, "VITE_").VITE_APP_URL),
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
