import { defineComponentConfig } from '@keenmate/web-components-devkit/vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

// Root config — the examples site only (dev server + `vite build --mode examples`).
// Ports, the kit, fragment pages and the static multi-page build come from
// package.json#kmwc (`library.shouldBuild: false`: plain `vite build` refuses to run
// here). The published package builds itself (`npm run build` →
// packages/web-grid: cem analyze + tsc + its own vite.config.ts).

const gridPackageJson = JSON.parse(readFileSync('./packages/web-grid/package.json', 'utf-8'));

// index.ts stamps `window.components['web-grid']` with these. The preset defines them
// from the ROOT package.json (the private workspace), so they're overridden with the
// package's own values — the same ones its library build injects.
const gridDefines = {
  __VERSION__: JSON.stringify(gridPackageJson.version),
  __PACKAGE_NAME__: JSON.stringify(gridPackageJson.name),
  __AUTHOR__: JSON.stringify(gridPackageJson.author ?? 'Keenmate'),
  __LICENSE__: JSON.stringify(gridPackageJson.license ?? 'MIT'),
  __REPOSITORY__: JSON.stringify(gridPackageJson.repository?.url ?? ''),
  __HOMEPAGE__: JSON.stringify(gridPackageJson.homepage ?? ''),
};

export default defineComponentConfig({
  overrides: {
    define: gridDefines,
    resolve: {
      alias: {
        // Pages and e2e fixtures import the package by name; serve its TS source
        // (hot reload) instead of the built dist/.
        '@keenmate/web-grid/css': resolve(__dirname, 'packages/web-grid/src/css/main.css'),
        '@keenmate/web-grid': resolve(__dirname, 'packages/web-grid/src/index.ts'),
      },
    },
    // Dev dep-scan only the real pages and the e2e fixtures — not test-results/ etc.
    optimizeDeps: { entries: ['index.html', 'examples-*.html', 'test/*.html'] },
  },
});
