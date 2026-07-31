import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 기본값은 IPv6(localhost)만 바인딩하여 127.0.0.1로 접속이 거부됨.
    host: true,
  },
})
