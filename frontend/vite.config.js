import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// Proxy compartido: reescribe /api → backend y fija Origin a localhost para
// que FastAPI acepte peticiones llegadas desde túneles externos (cloudflared, ngrok…)
const apiProxy = {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('origin', 'http://localhost:5173')
      })
    },
  },
}

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        removeDimensions: true, // elimina width/height del SVG; el viewBox + CSS mandan
      },
    }),
  ],
  server: {
    allowedHosts: true,
    proxy: apiProxy,
  },
  preview: {
    allowedHosts: true,
    proxy: apiProxy,
  },
})
