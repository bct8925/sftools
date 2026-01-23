/**
 * Minimal LWC plugin for Vite that only compiles LWC components
 * without interfering with the rest of the build system.
 *
 * This plugin wraps @lwc/rollup-plugin and adds virtual module handling
 * to prevent conflicts with Vite's native HTML and CSS processing.
 */

import lwcCompiler from '@lwc/rollup-plugin';
import { createFilter } from 'vite';

export default function lwcMinimal(options = {}) {
  const modulesDir = options.modulesDir || '**/modules/**';
  const filter = createFilter(modulesDir);

  // Create the underlying LWC rollup plugin
  const lwcPlugin = lwcCompiler({
    rootDir: options.rootDir,
    modules: options.modules || [],
    ...options
  });

  // Extract the handlers
  const buildStart = lwcPlugin.buildStart?.handler || lwcPlugin.buildStart || (() => {});
  const resolveId = lwcPlugin.resolveId?.handler || lwcPlugin.resolveId || (() => null);
  const load = lwcPlugin.load?.handler || lwcPlugin.load || (() => null);
  const transform = lwcPlugin.transform?.handler || lwcPlugin.transform || (() => null);

  return {
    name: 'lwc-minimal',
    enforce: 'pre',

    async buildStart(opts) {
      return buildStart.call(this, opts);
    },

    async resolveId(source, importer, opts) {
      // Only handle LWC-related resolutions
      if (source.startsWith('c/') || source.startsWith('lwc')) {
        return resolveId.call(this, source, importer, opts);
      }
      // Handle relative imports from within modules directory
      if (importer && filter(importer)) {
        const result = await resolveId.call(this, source, importer, opts);
        // Add virtual suffix for HTML files to prevent Vite's handlers from interfering
        if (result && result.endsWith('.html')) {
          return result + '?lwc-html';
        }
        // For CSS, change extension to prevent Vite CSS handling
        if (result && result.endsWith('.css')) {
          return result + '.lwc.js';
        }
        return result;
      }
      return null;
    },

    async load(id) {
      // Handle LWC internal resources (like @lwc/resources/empty_css.css)
      if (id.startsWith('@lwc/')) {
        const cleanId = id.replace(/\.lwc\.js$/, '');
        const result = await load.call(this, cleanId);
        // If the result is undefined or indicates an empty/missing file, return empty stylesheet
        if (!result || result === 'undefined' || (typeof result === 'string' && result.includes('undefined'))) {
          return 'export default [];';
        }
        return result;
      }

      // Clean virtual suffixes
      let cleanId = id.replace(/\?lwc-html$/, '').replace(/\.lwc\.js$/, '');
      if (!filter(cleanId)) {
        return null;
      }
      return load.call(this, cleanId);
    },

    async transform(code, id) {
      // Clean virtual suffixes
      const cleanId = id.replace(/\?lwc-html$/, '').replace(/\.lwc\.js$/, '');
      if (!filter(cleanId)) {
        return null;
      }
      const result = await transform.call(this, code, cleanId);
      // Ensure we return in Vite-compatible format
      if (result && typeof result === 'string') {
        return { code: result };
      }
      return result;
    }
  };
}
