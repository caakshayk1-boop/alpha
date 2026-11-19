import { defineConfig } from 'astro/config';
import { FontaineTransform } from 'fontaine';
import { fileURLToPath } from 'node:url';
const demo = process.env.RULEBOOK_DEMO === '1';
export default defineConfig({
  site: 'https://lockedfree.askakshay.com',
  output: 'static', trailingSlash: 'always', outDir: demo ? './dist-demo' : './dist',
  build: { inlineStylesheets: 'never', format: 'directory' },
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 0 },
    plugins: [FontaineTransform.vite({ fallbacks: { 'Fira Sans': ['Arial'], 'JetBrains Mono Variable': ['Courier New'] }, resolvePath: (id) => new URL('file://' + fileURLToPath(new URL('./node_modules/', import.meta.url)) + id.replace(/^\//, '')) })],
  },
});
