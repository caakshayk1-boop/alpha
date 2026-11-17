# ApexPro — Evidence Observatory

Live: https://apexpro.askakshay.com

Editable vanilla ES modules live in `src/`. Styles, fonts and vendored motion libraries live in `public/`. `public/app.js` and `public/reel.js` are generated; edit source, then build.

```
node apps/apexpro/tools/build.mjs
node --test apps/apexpro/tests/model.test.mjs
node apps/apexpro/tests/technical.mjs
node apps/apexpro/tests/time-machine.mjs
node apps/apexpro/tests/session-pulse.mjs
node apps/apexpro/tools/release-check.mjs
npx wrangler dev --config wrangler.apexpro.jsonc --port 8810
```

With the dev server running, run `ultimatum.mjs`, `chart-intervals.mjs`, `session.mjs`, `resilience.mjs`, `ultimatum-accessibility.mjs` and `production.mjs` under `tests/`.

Deploy: `npx wrangler deploy --config wrangler.apexpro.jsonc`. For a future CSS/JS release, bump the service-worker VERSION as well; build synchronizes SHELL. Preserve worker/data contracts and user storage namespaces.

The exported company brief prints to PDF. The reel action downloads a self-contained HyperFrames ZIP (not an MP4). Unzip and run the commands in its README to render the 20-second vertical clip locally. A tested example and proof reports live in `docs/apexpro/ultimatum/proof/`.

The initial Ultimatum release retains baseline-dependent audit tools for reproducibility; tools that read `/tmp/apexpro-pre-ultimatum-public` need that original capture. They are proof tooling, not production dependencies.
