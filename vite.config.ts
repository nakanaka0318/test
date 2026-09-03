import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // three.js を含む単一バンドルなので既定の警告しきい値を引き上げる
  build: { chunkSizeWarningLimit: 1200 },
})
