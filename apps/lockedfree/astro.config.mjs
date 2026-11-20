import { appendFile, readdir } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import { FontaineTransform } from 'fontaine';
import { fileURLToPath } from 'node:url';
const demo = process.env.RULEBOOK_DEMO === '1';
export default defineConfig({
  site: 'https://lockedfree.askakshay.com',
  output: 'static', trailingSlash: 'always', outDir: demo ? './dist-demo' : './dist',
  build: { inlineStylesheets: 'never', format: 'directory' },
  integrations: [{ name: 'lockedfree-asset-charset', hooks: {
    'astro:build:done': async ({ dir }) => {
      const files = await readdir(new URL('_astro/', dir));
      const rules = files.filter(name => name.endsWith('.js') || name.endsWith('.mjs'))
        .map(name => `/_astro/${name}\n  Content-Type: application/javascript; charset=utf-8\n`);
      await appendFile(new URL('_headers', dir), rules.join(''));
    }
  } }],
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 0 },
    plugins: [FontaineTransform.vite({ fallbacks: { 'Fira Sans': ['Arial'], 'JetBrains Mono Variable': ['Courier New'] }, resolvePath: (id) => new URL('file://' + fileURLToPath(new URL('./node_modules/', import.meta.url)) + id.replace(/^\//, '')) })],
  },
});
