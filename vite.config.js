import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = (env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000').replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5174,
      /** Abre el navegador en la ruta real (incluido si el puerto cambia por estar ocupado). */
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
