import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Optimize for Arweave deployment
    rollupOptions: {
      output: {
        // Create fewer chunks for easier bundling
        manualChunks: undefined,
      }
    },
    // Inline small assets
    assetsInlineLimit: 4096,
    // Generate source maps for debugging
    sourcemap: false,
    // Minimize output
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  define: {
    // Define global constants for Arweave deployment
    __ARWEAVE_DEPLOYMENT__: 'true'
  },
  // Ensure compatibility with older browsers
  target: 'es2015'
})
