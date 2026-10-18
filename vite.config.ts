import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` lets the built site work from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
