import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 3000,
    open: false,
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx'],
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lightweight-charts')) {
              return 'vendor-chart';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('pako')) {
              return 'vendor-pako';
            }
            return 'vendor-utils';
          }
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'lightweight-charts',
      'lucide-react',
      'pako',
      'clsx',
      'tailwind-merge',
    ],
  },
});
