import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { taskReviewPreviewBuild } from './src/taskReviewMode.ts';

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.TASK_REVIEW_PREVIEW': JSON.stringify(taskReviewPreviewBuild(process.env.VERCEL_ENV, process.env.VERCEL_GIT_COMMIT_REF)) },
  base: process.env.VITE_BASE_PATH || '/',
  optimizeDeps: { include: ['nspell'] },
  build: { cssMinify: 'lightningcss' },
});
