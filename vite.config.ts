import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    // Firebase Hosting deploys this directory (see firebase.json).
    outDir: 'build'
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
