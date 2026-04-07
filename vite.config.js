import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = (env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000').replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      /** 5180: evita colisiones con el frontend del motor (5173) y otros Vite en 5174+. */
      port: 5180,
      strictPort: true,
      open: '/validar',
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  }
})
