---
description: Prepare @keenmate/web-grid for npm publish — bump version, finalize CHANGELOG/READMEs, build, test, commit
argument-hint: rc|release|patch|minor|major
---

# /publish — prepare an npm release of @keenmate/web-grid

You are preparing this package for `npm publish`. **Do not run `npm publish`** — the user logs in and publishes manually.

## Argument

The release type: **$ARGUMENTS**

Must be one of:

- `rc` — ship the WIP rc as-is. The topmost CHANGELOG heading (e.g. `## [1.6.0-rc01] - 2026-06-11`) gets ` [PUBLISHED]` appended. Rare in this repo today — the last rc was `1.2.0-rc01` — but supported for future use.
- `release` — promote a WIP rc to a final release. `1.6.0-rcN` → `1.6.0`. CHANGELOG heading is renamed to match the new version.
- `patch` — SemVer patch bump. Drops any `-rc` suffix. `1.5.2-rcN` → `1.5.2`, `1.5.1` → `1.5.2`.
- `minor` — SemVer minor bump. Drops `-rc`. Resets patch.
- `major` — SemVer major bump. Drops `-rc`. Resets minor and patch.

If missing or invalid, stop and ask the user which one to use (don't guess).

## Repo layout

This is an **npm workspaces monorepo**. The publishable package lives at `packages/web-grid/`; the workspace root holds the docs site, e2e tests, and the changelog. Key paths:

- **`packages/web-grid/package.json`** — `version` field is the source of truth for the published package. (The root `package.json` is `"private": true` and never published.)
- **`CHANGELOG.md`** at the **repo root** — historical quirk. The changelog tracks releases of `@keenmate/web-grid` even though it lives outside `PKG_DIR`. Topmost `## [X.Y.Z] - YYYY-MM-DD` heading **without** the `[PUBLISHED]` marker is the WIP section.
- **`README.md` source of truth is the repo root**: `./README.md` is the canonical README; `./packages/web-grid/README.md` is a **build artifact** copied over by `make package` (the `.gitignore` lists it as "copied to package dir during build (source is root)"). The package README is still tracked in git for legacy reasons (it was committed before being added to `.gitignore`, and git keeps tracking already-tracked paths), so changes there show up in `git status` and need to be staged — but you should only ever *edit* the root README; `make package` will overwrite the package one to match. To avoid mysterious "tracked-but-gitignored" diffs, also copy the root README over the package README during this flow (mirrors what `make package` does later anyway) and stage both.
- **`LICENSE`** lives at `./packages/web-grid/LICENSE` (ships in the tarball).
- **`packages/web-grid/dist/`** — gitignored. Produced by `make build` (or `npm run build -w @keenmate/web-grid`). Never staged.
- **`packages/web-grid/component-variables.manifest.json`** — manifest published with the package; edit if the variable surface changes.
- **`docs/`** — the demo / examples site. Not packed.
- **`e2e/`** — Playwright specs run from the workspace root via `npm run test:e2e`. Not packed.
- **`Makefile`** at root provides convenience targets: `make build`, `make package`, `make publish`, `make publish-rc`, `make publish-dry`, `make test-e2e`.

## CHANGELOG convention in this repo

There is **no `## [Unreleased]` section**. The WIP section is the topmost `## [X.Y.Z] - YYYY-MM-DD` heading without a `[PUBLISHED]` tag. Already-released sections carry `[PUBLISHED]` at the end of their heading:

```
## [1.6.0] - 2026-06-11                  ← WIP, the one you're shipping
### Added
- ...

## [1.5.1] - 2026-06-10 [PUBLISHED]
### Added
- ...
```

Publishing the WIP section means **appending ` [PUBLISHED]`** to its heading — exact format: `## [X.Y.Z] - YYYY-MM-DD [PUBLISHED]`. The next development cycle creates a fresh `## [next-version] - <date>` heading on its first CHANGELOG edit.

**Known data drift**: several recent releases (1.3.0, 1.4.0, 1.5.0, 1.5.1) shipped via prod merges and were tagged in `package.json` but never npm-published, so their CHANGELOG headings may be missing `[PUBLISHED]` even though the `package.json` version moved on. Don't retro-fix older sections — only finalize the section you're shipping. Substring searches for `PUBLISHED` still work; missing tags on older sections just mean "this version wasn't formally pushed to npm at the time."

## Resolve versions

Read `./packages/web-grid/package.json` `version` as `CURRENT_VERSION`.
Read the topmost `## [X.Y.Z...]` heading from `./CHANGELOG.md` as `WIP_VERSION`.

Compute `NEW_VERSION`:

| Argument | Logic |
|---|---|
| `rc` | If `CURRENT_VERSION` matches `X.Y.Z-rcN`, `NEW_VERSION = CURRENT_VERSION` (no bump — we're shipping what's already in package.json). If `CURRENT_VERSION` is a stable version, bump to the first rc of the next minor: `X.Y.Z` → `X.(Y+1).0-rc01`. Warn the user about the implicit minor bump and ask to confirm. |
| `release` | If `CURRENT_VERSION` matches `X.Y.Z-rcN`, `NEW_VERSION = X.Y.Z`. Otherwise stop. |
| `patch` | Strip any `-rcN`, then bump patch. |
| `minor` | Strip any `-rcN`, then bump minor, reset patch. |
| `major` | Strip any `-rcN`, then bump major, reset minor and patch. |

If `WIP_VERSION` ≠ `NEW_VERSION` (e.g. the WIP is `1.6.0-rc01` but the user asked for `release`), the CHANGELOG heading rename in step 3 also re-tags the section to `NEW_VERSION` — call this out in the report so the user notices.

## Steps (in order)

### 1. Sanity checks

- Run `git status`. The repo intentionally keeps `.claude/`, `test-results/`, `docs/build/`, and similar local-only paths untracked or unstaged — those are fine. If there are **other** uncommitted changes that aren't `CHANGELOG.md`, `./README.md`, `./packages/web-grid/README.md`, or `./packages/web-grid/package.json`, list them and ask the user before continuing. (Typical case: substantive source changes belonging in this release that haven't been committed yet — confirm they're intended for this version before bumping.)
- **Verify the new version isn't already on npm.** Run `npm view @keenmate/web-grid@<NEW_VERSION> version 2>/dev/null` — if it returns the version string, that version is already published and **stop**: bumping over it would fail at publish time and pollute the commit. Also run `npm view @keenmate/web-grid version` to fetch the latest published version on the `latest` tag; if it's higher than `NEW_VERSION`, warn the user (mismatch between local package.json history and the registry — likely caused by the data drift mentioned above) and ask before continuing.
- Confirm the WIP CHANGELOG section has at least one bullet of substantive content under `### Added`, `### Changed`, `### Removed`, `### Fixed`, `### Internal`, or `### Notes`. If empty, stop — there's nothing meaningful to release.
- Confirm `./README.md` (the root, canonical README) has a `## What's New in vWIP_VERSION` section. If it's missing, draft one from the CHANGELOG and present it to the user for approval before continuing:
  - Read the WIP CHANGELOG section, distill it to 5–8 scannable bullets covering the Added/Changed themes (paraphrase, don't copy CHANGELOG bullets verbatim — those are exhaustive; What's New is the highlight reel). Pure internal refactors and Fixed-only entries don't need coverage, though headline bug fixes worth advertising are worth a bullet. Follow the formatting of existing `## What's New in vX.Y.Z` sections in the README (bold lead phrase + em-dash + 1–2 sentence explanation).
  - Show the user the proposed draft as plain markdown in your reply. Ask whether to (a) insert as-is, (b) edit, or (c) abort so they can write it themselves.
  - Only proceed past step 1 once the user approves the draft (or supplies their own). On approval, insert the section directly above the current top `## What's New in vX.Y.Z` heading in `./README.md`, then continue. (The package README copy is reconciled in step 4 — no need to edit it here.)
  - Do not silently insert the draft without confirmation — release highlights are a writing call and the user owns the voice.

### 2. Bump version (if needed)

If `NEW_VERSION` ≠ `CURRENT_VERSION`, edit `./packages/web-grid/package.json` and change `"version": "CURRENT_VERSION"` to `"version": "NEW_VERSION"`.

There is no per-package `package-lock.json` to re-sync — this monorepo's root `package-lock.json` is regenerated by `npm install` at the workspace root if needed, but a version bump on a single workspace package doesn't require a lockfile change.

For `rc` arg this is normally a no-op — version was bumped earlier in the development cycle. The exception is the "rc from stable" case described above; if that applies, the bump happens here.

### 3. Finalize CHANGELOG

In `./CHANGELOG.md` (at repo root, **not** under `packages/`):

- If `WIP_VERSION` ≠ `NEW_VERSION` (e.g. promoting `1.6.0-rc01` → `1.6.0`), rename the WIP heading from `## [WIP_VERSION] - <date>` to `## [NEW_VERSION] - <today>` (today's date from system context).
- If `WIP_VERSION` == `NEW_VERSION`, leave the bracketed version alone but update the date to today **if** the existing date is stale (more than a few days old). The WIP date is usually whatever the day the section was opened; refresh it so the changelog reflects the actual ship date.
- In either case, **append ` [PUBLISHED]`** to the heading so it reads exactly: `## [NEW_VERSION] - YYYY-MM-DD [PUBLISHED]`.
- Leave all bullet content untouched.
- **Do not** create an empty new WIP section — the next dev cycle's first CHANGELOG edit will create one.

### 4. Update root README's "What's New" — only if version changed — then sync package README

Edit `./README.md` (the root, canonical README):

- If the existing `## What's New in vWIP_VERSION` section's version differs from `NEW_VERSION` (e.g. promoting `1.6.0-rc01` → `1.6.0`), rename its heading to `## What's New in vNEW_VERSION`. (No content rewrites — the text was already curated for this release.)
- Then count the `## What's New in vX.Y.Z` headings. If there are more than **two**, delete the oldest ones so only the **two most recent** remain (the just-finalized one plus the one before it).

For `rc` arg this is normally a no-op on the heading itself — only trims if someone left an extra-old section behind.

Then **sync the package README**: copy `./README.md` over `./packages/web-grid/README.md` (this is what `make package` does later anyway; doing it here pre-stage keeps the diff understandable and stops the commit from leaving a tracked-file mismatch).

Confirm by running `diff ./README.md ./packages/web-grid/README.md` — output should be empty. Treat any divergence as a blocker.

### 5. Validate README reflects the release

Read both the finalized CHANGELOG section and the matching `What's New in vNEW_VERSION` section in `./README.md`. Every **Added** or **Changed** bullet in the CHANGELOG that represents a user-facing feature or behavior change should have a corresponding hit in the What's New section (paraphrased, not verbatim). Pure internal refactors and `Fixed`-only entries don't need coverage, though headline bug fixes worth advertising (e.g. "X used to silently fail; now works") are worth a bullet.

If you find a significant CHANGELOG entry that isn't reflected in What's New, add a bullet for it. If the section ends up with more than ~8 bullets after this pass, condense — What's New should be scannable, not exhaustive.

After editing, **re-sync the package README**: copy `./README.md` over `./packages/web-grid/README.md` and re-run the `diff` to confirm. The two must stay byte-identical until commit.

### 6. Validate CHANGELOG entries match recent work

Find the previous `[PUBLISHED]` tag in CHANGELOG (the version just before NEW_VERSION) and locate the commit that bumped to it — usually a commit whose subject starts with `v<previous-version>` or `- v<previous-version>`. Run `git log --oneline <previous-publish-commit>..HEAD` to list commits since.

Also check `git diff` (or `git status`) for any uncommitted source/test work outside the files you're editing in this command.

For every substantive commit or uncommitted change, verify the WIP CHANGELOG section mentions it. If something significant is missing, **stop and ask the user** before finalizing — don't invent entries on their behalf. Pure example/doc tweaks and trivial typo fixes don't need entries.

### 7. Run e2e tests

Run `npm run test:e2e` from the **workspace root** (equivalently `make test-e2e`). All specs must pass.

If anything fails, **stop and report**. Do not proceed to build/commit. The user fixes the regression (or decides to fixme the spec) before the publish flow can continue.

If Playwright complains that chromium isn't installed, suggest `npm run test:e2e:install` (or `make test-e2e-install`) and stop.

### 8. Build the package

Run `make package` from the workspace root. **Use `make package`, not `make build`** — `make package` is the one that:

1. Cleans `packages/web-grid/dist/`.
2. Runs `tsc` for the type declarations, then Vite to emit `packages/web-grid/dist/web-grid.js`, `packages/web-grid/dist/web-grid.umd.js`, and `packages/web-grid/dist/index.d.ts` (+ all the per-module `.d.ts` files).
3. **Copies `./README.md` → `./packages/web-grid/README.md` and `./ai/` → `./packages/web-grid/ai/`** — these are the canonical sources at root, and `npm pack` needs them under `packages/web-grid/`.

`make build` skips step 3 (just builds the library and docs), which is fine for development but leaves the package's README / ai folder potentially stale at publish time.

If the build errors, stop and report.

After build, do a quick smoke check on the emitted artifacts under `packages/web-grid/`:

- `dist/web-grid.js` and `dist/web-grid.umd.js` both exist and are non-empty.
- `dist/index.d.ts` (the `types` field target) exists.
- `README.md` now matches `./README.md` byte-for-byte (the copy step ran).
- `ai/` exists and has the same files as the root `ai/`.

Note: web-grid does **not** emit a `dist/style.css` like web-multiselect does — CSS is shipped as the raw files under `packages/web-grid/src/css/`, exposed via the `./css` export. So no `dist/style.css` check.

### 9. Verify the package contents

Run `make publish-dry` from the workspace root (or `cd packages/web-grid && npm pack --dry-run`) and confirm the file list includes:

- `dist/` (built JS + d.ts files)
- `src/css/` (raw CSS files exposed via the `./css` and `./src/css/*` exports)
- `ai/` (the prose-doc bundle for AI consumers — intentional)
- `component-variables.manifest.json`
- `README.md`
- `LICENSE`
- `package.json`

If anything user-facing is missing or anything private leaked in (e.g. `test/`, `e2e/`, `docs/`, `examples-*.html`, `*.spec.ts`, `tsconfig.json`, `vite.config.ts`), stop and report — the `files` field in `package.json` controls this and the leak needs fixing before publish.

### 10. Commit

Stage:

- `./CHANGELOG.md`
- `./README.md`
- `./packages/web-grid/README.md`
- `./packages/web-grid/package.json`

Do **not** stage `packages/web-grid/dist/` — it's gitignored.

Commit message format — matches the cross-component convention (web-multiselect, web-daterangepicker, web-grid's own recent commits all use this):

```
vNEW_VERSION - <one-line summary of the headline change>

<grouped bullets paraphrased from the CHANGELOG section — split into the same
groups the CHANGELOG used: Added, Fixed, Changed, Internal, etc. Keep bullets
terse; full prose lives in the CHANGELOG.>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

The `vX.Y.Z - …` subject style and the `Co-Authored-By: Claude Opus 4.7 (1M context)` trailer both match recent release commits in this repo (see commits `4c4c062`, `64909fb`, `ec0241e`).

### 11. Report

Report back with:

- The new version number
- The commit SHA
- The exact commands to publish. **Pick the right one for the arg type:**
  - For `rc` (publishing a pre-release):
    ```
    cd packages/web-grid
    npm login          # if not already logged in
    npm publish --tag rc
    ```
    Or `make publish-rc` from the workspace root (Makefile target wraps the cd + publish). The `--tag rc` is critical — without it npm assigns the `latest` dist-tag, which would make the pre-release the default install for everyone running `npm install @keenmate/web-grid`. With `--tag rc`, the `latest` tag stays put and consumers opt in via `@rc` or pinning the exact version.
  - For `release` / `patch` / `minor` / `major` (publishing a stable release):
    ```
    cd packages/web-grid
    npm login          # if not already logged in
    npm publish
    ```
    Or `make publish`. No `--tag` needed — it correctly lands as `latest`.
- A reminder that the CHANGELOG `[PUBLISHED]` tag is now in place — if `npm publish` fails, the user should revert the commit (`git reset --hard HEAD~1`) before retrying, since the registry will refuse to re-publish the same version.

## Things not to do

- **Do not run `npm publish`.** The user publishes manually after `npm login`.
- **Do not push to git remote.** The commit stays local until the user pushes.
- **Do not create an empty `[Unreleased]` or new WIP heading** in CHANGELOG after finalizing — the next dev cycle's first edit creates the next heading.
- **Do not retro-fix older CHANGELOG sections** that are missing the `[PUBLISHED]` tag — several historical sections (1.3.0/1.4.0/1.5.0/1.5.1) silently went out without one, and editing them noises up the diff. Only finalize the section you're shipping.
- **Do not silently insert a drafted What's New section.** If you draft one in Step 1 because it's missing, you must present it and wait for explicit approval (or edits) before inserting — the writing voice is the user's call, even when you're handing them a starting point.
- **Do not edit `./packages/web-grid/README.md` directly.** The root `./README.md` is the source of truth; `make package` copies it over. The publish flow only touches the package README to mirror the root before commit, so the two stay in sync in the working tree.
- **Do not keep more than two `## What's New in vX.Y.Z` sections** in the README. Step 4 trims older ones; if you see three or more after Step 4, you missed one.
- **Do not skip `make build`** — without it `packages/web-grid/dist/` is stale and the publish would ship outdated artifacts (or fail entirely if `dist/` was wiped by `make clean`).
- **Do not skip the e2e run** — this repo's tests have caught real regressions during the 1.3.0/1.4.0 cycles, and the gate is explicit. The suite runs ~30s and covers ~290 specs.
- **Do not invent CHANGELOG entries** to cover commits you find; ask the user if something's missing.
- **Do not bump if there's nothing meaningful in the WIP section** — stop and explain.
- **Do not stage `dist/`, `e2e/`, `test-results/`, `docs/build/`, or anything under `docs/`** — they're either ignored, test artifacts, or workspace-only paths that don't belong in the publish commit.
