import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The single-page app is always served same-origin as the API (nginx in the
// container, the Vite server locally), so the session cookie stays first-party
// and no CORS configuration sits on the critical path.
const apiTarget = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000'
const devPort = Number(process.env.VITE_PORT ?? 5173)

const proxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: devPort,
    strictPort: false,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: devPort,
    strictPort: false,
    proxy,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
})
