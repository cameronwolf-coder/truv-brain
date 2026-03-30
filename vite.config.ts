import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __GIT_COMMIT_SHA__: JSON.stringify(process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev'),
    __GIT_COMMIT_MESSAGE__: JSON.stringify(process.env.GIT_COMMIT_MESSAGE || process.env.VERCEL_GIT_COMMIT_MESSAGE || ''),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/los-pos': {
        target: 'https://em8y3yp3qk.us-east-1.awsapprunner.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/los-pos/, ''),
      },
    },
  },
})
