import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' يجعل التطبيق يعمل على GitHub Pages أياً كان اسم المستودع
export default defineConfig({
  plugins: [react()],
  base: './',
  test: { environment: 'node' },
});
