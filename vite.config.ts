import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { taskReviewPreviewBuild } from './src/taskReviewMode.ts';

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.TASK_REVIEW_PREVIEW': JSON.stringify(taskReviewPreviewBuild(process.env.VERCEL_ENV, process.env.VERCEL_GIT_COMMIT_REF)) },
  base: process.env.VITE_BASE_PATH || '/',
  optimizeDeps: { include: ['nspell'] },
  build: {
    cssMinify: 'lightningcss',
    // Библиотеки — в отдельных файлах: они меняются редко и остаются в кеше браузера после обновлений игры,
    // а скачиваются параллельно с кодом приложения.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(@firebase|firebase|idb|re2js)\//.test(id)) return 'vendor-firebase';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
});
