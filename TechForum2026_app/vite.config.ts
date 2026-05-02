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
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify: file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
