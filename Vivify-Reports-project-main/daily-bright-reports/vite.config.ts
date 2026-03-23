import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  // ✅ CHANGED to relative path for Capacitor/Android to work
  base: "./",

  server: {
    host: "::",
   port: 5173, 
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // ✅ Optional (removes chunk size warning)
  build: {
    chunkSizeWarningLimit: 1500,
  },
}));
