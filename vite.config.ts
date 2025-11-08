import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  // Explicitly set public directory to ensure files are copied
  publicDir: 'public',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Handle missing optional dependencies
      '@algorandfoundation/liquid-auth-use-wallet-client': path.resolve(__dirname, './empty-module.js'),
      '@algorandfoundation/liquid-client': path.resolve(__dirname, './empty-module.js'),
    },
  },
  define: {
    // Define global variables
    'process.env': {},
  },
  optimizeDeps: {
    // Exclude problematic packages from pre-bundling
    exclude: [
      '@algorandfoundation/liquid-auth-use-wallet-client',
      '@algorandfoundation/liquid-client',
    ],
  },
  build: {
    // Handle chunk size warnings
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'wallet-vendor': ['@txnlab/use-wallet-react', '@txnlab/use-wallet', '@walletconnect/modal', '@walletconnect/sign-client'],
        },
      },
    },
  },
  server: {
    port: 3999,
  },
});

