import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { inlineHtmlPlugin } from './src/plugins/inline-html'
import { sharedConfig } from './vite.config.shared'

export default defineConfig({
  ...sharedConfig,
  plugins: [svelte(), inlineHtmlPlugin()],
  css: {
    preprocessorOptions: {
      sass: {
        additionalData: (d) => {
          const prepend = `@use "@src/ui/styles/utils.sass" as tint\n`
          const match = d.match(/^\s*/)
          const spaces = match ? match[0] : ''
          return `${spaces}${prepend}\n${d}`
        },
      },
    },
  },
  build: {
    ...sharedConfig.build,
    // Figma plugins ship as a single HTML file; the custom inline-html plugin
    // only inlines .css/.js, so any imported asset that gets emitted as a
    // separate file (Vite's default cutoff is 4 KiB) will 404 at runtime.
    // Force every asset to inline as a base64 data URL.
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    rollupOptions: {
      ...sharedConfig.rollupOptions,
      input: 'index.html', // Only UI entry
      output: {
        format: 'iife', // Self-contained IIFE
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        inlineDynamicImports: true // Bundle everything into one file
      }
    }
  }
})
