import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// BUG_FIX_CONTEXT: предыдущая версия вызывала loadEnv(mode, '.', '') с пустым
// prefix-параметром, но не использовала результат — это приводило к загрузке
// .env-файлов с переменными БЕЗ префикса VITE_ (внутрь process.env), что не
// нужно для клиентского bundle. Vite по дефолту инжектит только VITE_*
// переменные. Достаточно стандартного поведения — никакой кастомной envPrefix
// логики не нужно.
// BUG_FIX_CONTEXT (FIND-007): Раньше всё ехало в один index-*.js (628 KB).
// На медленной мобильной сети первая загрузка APK web-bundle тянулась 3+ сек.
// manualChunks выносит тяжёлые библиотеки в отдельные файлы — браузер
// параллелит загрузку, общие модули кэшируются между релизами (хеш не
// меняется при правке только src/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-dom') || id.includes('scheduler') || /node_modules\/react\//.test(id)) return 'vendor-react';
          if (id.includes('motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('socket.io-client')) return 'vendor-socket';
          if (id.includes('wavesurfer')) return 'vendor-audio';
          if (id.includes('qrcode')) return 'vendor-qr';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('zod')) return 'vendor-zod';
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    proxy: {
      '/api/v1': {
        target: 'http://72.56.38.62:3100',
        changeOrigin: true,
      },
    },
  },
});
