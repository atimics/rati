// Custom Vite plugin to handle Node.js polyfills for browser compatibility
export function nodePolyfills() {
  return {
    name: 'node-polyfills',
    config(config) {
      // Ensure polyfills are not externalized
      config.build = config.build || {};
      config.build.rollupOptions = config.build.rollupOptions || {};
      config.build.rollupOptions.external = config.build.rollupOptions.external || [];
      
      // Remove buffer, process, util from external list if present
      if (Array.isArray(config.build.rollupOptions.external)) {
        config.build.rollupOptions.external = config.build.rollupOptions.external.filter(
          ext => !['buffer', 'process', 'util'].includes(ext)
        );
      }
    },
    configResolved(resolvedConfig) {
      // Force these modules to be bundled
      resolvedConfig.optimizeDeps.include = resolvedConfig.optimizeDeps.include || [];
      resolvedConfig.optimizeDeps.include.push('buffer', 'process/browser', 'util');
    }
  };
}
