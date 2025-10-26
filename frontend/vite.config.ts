import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Pre-bundle lucide-react to avoid per-icon ESM requests (some ad-blockers block files named `fingerprint.js`).
    include: ['lucide-react'],
  },
});
