import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',       // Vercel 기본 output 디렉토리
    sourcemap: false,     // 프로덕션 배포 시 소스맵 비활성화
  },
})
