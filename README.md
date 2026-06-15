# Acorn Annotations

Figma plugin for quickly adding accessibility annotations to designs, by helping users document focus order, semantics, and screen reader behavior directly on the canvas.

The plugin is designed primarily for Firefox designers working with Acorn design system libraries, including support for component-note annotations that reference Acorn components, but works in any Figma file.

## Usage

The plugin is published on the Figma Community. Install it from there to use it in your own files.

Annotations require a small set of Figma components to exist in your file. The plugin walks you through wrapping your design, creating an info frame, and selecting both before you start. For a full walkthrough see the in-plugin Help screen or the [annotation guide](https://acorn.firefox.com/latest/support/resources/designer/a11y-figma-annotations-KFdQgdPq) on the Acorn site.

## Development

Clone the repo and install dependencies with `npm install`.

The project uses a dual Vite build. Plugin code (Figma API context) and UI code (sandboxed iframe) are built separately into a single `dist/` folder.

```bash
npm run watch    # Rebuild on changes, recommended during development
npm run build    # One-off production build
npm run check    # Run svelte-check and TypeScript
npm run lint     # Run ESLint
```

To load the plugin in Figma, open the desktop app and go to Plugins → Development → Import plugin from manifest, then select `dist/manifest.json` after your first build. After code changes, reload from the same menu or use the keyboard shortcut to restart the plugin.

The UI is built with Svelte 5. The plugin context and UI context communicate through a typed message handler defined in `src/message-handler.ts`.

## License

Mozilla Public License 2.0. See [LICENSE](./LICENSE).
