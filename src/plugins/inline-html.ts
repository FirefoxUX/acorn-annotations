import type { Plugin } from 'vite'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { resolve } from 'path'

interface InlineHtmlOptions {
  /** Whether to remove the original JS and CSS files after inlining */
  deleteInlinedFiles?: boolean
}

export function inlineHtmlPlugin(options: InlineHtmlOptions = {}): Plugin {
  const { deleteInlinedFiles = true } = options

  return {
    name: 'inline-html',
    apply: 'build',
    writeBundle(outputOptions, bundle) {
      const outDir = outputOptions.dir || 'dist'

      // Find the HTML file
      const htmlFiles = Object.keys(bundle).filter((fileName) =>
        fileName.endsWith('.html'),
      )

      for (const htmlFile of htmlFiles) {
        const htmlPath = resolve(outDir, htmlFile)
        let htmlContent = readFileSync(htmlPath, 'utf-8')

        // Find and inline CSS files
        const cssMatches = htmlContent.match(
          /<link[^>]*href="([^"]*\.css)"[^>]*>/g,
        )
        if (cssMatches) {
          for (const match of cssMatches) {
            const hrefMatch = match.match(/href="([^"]*)"/)
            if (hrefMatch) {
              const cssFile = hrefMatch[1].startsWith('/')
                ? hrefMatch[1].substring(1)
                : hrefMatch[1]
              const cssPath = resolve(outDir, cssFile)

              try {
                const cssContent = readFileSync(cssPath, 'utf-8')
                const inlineStyle = `<style>${cssContent}</style>`
                htmlContent = htmlContent.replace(match, inlineStyle)

                // Delete the CSS file if requested
                if (deleteInlinedFiles && existsSync(cssPath)) {
                  unlinkSync(cssPath)
                }
              } catch (error) {
                console.warn(`Could not inline CSS file: ${cssFile}`, error)
              }
            }
          }
        }

        // Find and inline JS files (but not the code.js file)
        const jsMatches = htmlContent.match(
          /<script[^>]*src="([^"]*\.js)"[^>]*><\/script>/g,
        )
        if (jsMatches) {
          for (const match of jsMatches) {
            const srcMatch = match.match(/src="([^"]*)"/)
            if (srcMatch) {
              const jsFile = srcMatch[1].startsWith('/')
                ? srcMatch[1].substring(1)
                : srcMatch[1]

              // Skip code.js as it should remain separate
              if (jsFile === 'code.js') {
                continue
              }

              const jsPath = resolve(outDir, jsFile)

              try {
                const jsContent = readFileSync(jsPath, 'utf-8')
                // Preserve module type if it exists
                const isModule = match.includes('type="module"')
                const inlineScript = `<script${isModule ? ' type="module"' : ''}>${jsContent}</script>`
                htmlContent = htmlContent.replace(match, inlineScript)

                // Delete the JS file if requested
                if (deleteInlinedFiles && existsSync(jsPath)) {
                  unlinkSync(jsPath)
                }
              } catch (error) {
                console.warn(`Could not inline JS file: ${jsFile}`, error)
              }
            }
          }
        }

        // Write the updated HTML file
        writeFileSync(htmlPath, htmlContent)
      }

      // Also fix code.js exports for Figma
      const codeJsPath = resolve(outDir, 'code.js')
      if (existsSync(codeJsPath)) {
        let codeContent = readFileSync(codeJsPath, 'utf-8')

        // Remove export statements at the end - Figma doesn't support ES modules
        const exportRegex = /export\s*\{[^}]*\};?\s*$/g
        if (exportRegex.test(codeContent)) {
          codeContent = codeContent.replace(exportRegex, '')
          writeFileSync(codeJsPath, codeContent)
        }
      }
    },
  }
}
