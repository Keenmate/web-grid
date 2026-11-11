import { blissAnalyzerConfig, cssVariablesFromManifestPlugin } from '@keenmate/web-components-core/cem';
import { customElementVsCodePlugin } from 'custom-element-vs-code-integration';
import { customElementJetBrainsPlugin } from 'custom-element-jet-brains-integration';

/**
 * Custom Elements Manifest for <web-grid>.
 *
 * Core's `blissAnalyzerConfig()` wires `blissInputsPlugin()` first — it reads the
 * `static inputs` / `static events` tables (invisible to the stock analyzer) and
 * recognises `registerComponent()` as a definition — plus `stableOutputPlugin()`
 * (LF strings, modules sorted by path), so two runs in a row write identical
 * files. `cssVariablesFromManifestPlugin()` injects the `--wg-*` surface from
 * `component-variables.manifest.json` as `cssProperties`; the editor-integration
 * generators run after both and see the injected attributes + variables.
 */
export default blissAnalyzerConfig({
  globs: ['src/**/*.ts'],
  // exclude: core's default (tests + declarations); src/index.ts is analyzed — registerComponent() runs there.
  outdir: '.',
  plugins: [
    cssVariablesFromManifestPlugin(),
    customElementVsCodePlugin({ outdir: '.' }),
    customElementJetBrainsPlugin({ outdir: '.', packageJson: false }),
  ],
});
