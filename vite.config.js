import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    proxy: {
      '/it-proxy': {
        target: 'https://it.fursys.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/it-proxy/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // HttpOnly 쿠키를 JS에서 접근 가능하게 하고 도메인 제거
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map((c) =>
                c.replace(/;\s*HttpOnly/gi, '').replace(/;\s*Secure/gi, '').replace(/;\s*Domain=[^;]*/gi, '')
              );
            }
          });
        },
      },
    },
  },
})
