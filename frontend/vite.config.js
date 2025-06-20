import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    })
  ],
  mode: 'development',
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
    sourcemap: true,
    // Minimize output
    minify: false,
  },
  define: {
    // Define global constants for Arweave deployment
    __ARWEAVE_DEPLOYMENT__: 'true',
    global: 'globalThis',
  },
  // Ensure compatibility with older browsers
  target: 'es2015'
})
