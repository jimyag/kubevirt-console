import path from "path"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:11111",
      "/apis": "http://127.0.0.1:11111",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    modulePreload: false,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      supported: { 
        "top-level-await": true 
      },
    },
  },
})
