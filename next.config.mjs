/** Static export. worker/index.js serves it, proxies the data feeds and quotes.
 *  The app edition (NEXT_PUBLIC_EDITION=app, `npm run build:app`) exports to its own folder so it never overwrites the full site's `out/`;
 *  scripts/app-pack.mjs then reduces that folder to the app's pages (docs/app/README.md). */
const app = process.env.NEXT_PUBLIC_EDITION === 'app';
const nextConfig = { output: 'export', trailingSlash: true, images: { unoptimized: true }, ...(app ? { distDir: 'out-app-build' } : {}) };
export default nextConfig;
