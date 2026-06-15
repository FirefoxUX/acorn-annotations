import { createRequire } from 'module'
import path from 'path'

const require = createRequire(import.meta.url)

export const sharedConfig = {
  resolve: {
    alias: {
      '~tint': path.dirname(require.resolve('tint')),
      '@src': '/src',
      '@code': '/src/code',
      '@ui': '/src/ui',
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2017' as const,
    minify: false,
    emptyOutDir: false, // Don't empty dist folder (builds might run in parallel)
  },
  rollupOptions: {
    external: () => false, // Bundle all dependencies
  }
}
