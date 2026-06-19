import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@project/content': path.resolve(__dirname, '../../packages/content/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: true,
      interval: 250,
    },
  },
})
