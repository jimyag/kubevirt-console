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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
            return "vendor-react"
          }
          if (id.includes("node_modules/react-router")) {
            return "vendor-router"
          }
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/cmdk")) {
            return "vendor-radix"
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons"
          }
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-") || id.includes("node_modules/victory-vendor")) {
            return "vendor-charts"
          }
          if (id.includes("node_modules/xterm")) {
            return "vendor-terminal"
          }
          if (id.includes("node_modules/js-yaml")) {
            return "vendor-yaml"
          }
          if (id.includes("/src/vendor/") || id.includes("node_modules/@novnc")) {
            return "vendor-console"
          }
          if (id.includes("/src/resources/") || id.includes("/src/components/resource-management")) {
            return "resources"
          }
        },
      },
    },
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
