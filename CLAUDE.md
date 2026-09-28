@AGENTS.md

## Maintainer notes

- Program entries use a discriminated union on `status`
  (`src/content.config.ts`); open and ongoing programs fail the build if a
  listing field is missing. Folder names are validated in `generateId`, and
  `womens-learning` / `youth-children` are reserved for the area pages.
- `assertBespokePages` (`src/lib/content.ts`) runs while program pages are
  generated and fails the build when a `page:` value has no matching file in
  `src/pages/`.
- `Photo.astro` resolves named slots from `src/assets/photos/` with
  `import.meta.glob`; a missing file renders the geometric fallback, so slots
  never break the build.
- The giving form cannot pass an amount to the GiveWP form on oursabeel.com
  (no URL parameter support), so it opens the form and shows the donor their
  selection to re-enter. Point `site.giving` at a processor that accepts
  amounts to remove that step.
- `dateApprox: true` marks programs whose year is inferred rather than
  printed on the flyer; pages show only the year for them.
- `firebase.json` redirects other addresses for these pages (`/courses/`,
  `/our-team/`, `/seminary/`, `/donate/`, `/our-mission/`, `/my-courses/`,
  and more) so existing links keep working.
- Deploys, the Google identity pool, and every setting to change when the
  project, account, repository, branch, or domain moves are documented in
  `docs/deployment.md`. `preview.yml` runs from `main` via `workflow_run` and
  must never execute pull-request code.
- The visual comparison (`scripts/visual-diff/`, described in
  `docs/deployment.md`) skips pages whose HTML is identical in both builds.
  That relies on every asset a page loads living under `_astro/` with a
  content hash in its name; if `build.assets` or the asset naming changes,
  update `classifyPages` in `run.mjs`. Tailwind reads class names only from
  `src/` outside `src/content/` (top of `global.css`), so content, docs, and
  tooling edits leave the stylesheet, and with it every other page's HTML,
  unchanged.
- Screenshots use the Chromium build that matches the Playwright version in
  `scripts/visual-diff/package-lock.json`, not the system Chrome. A Chrome
  far from that version lays some full-page screenshots out at the wrong
  width, which shows up as false differences. To check repeatability, compare
  a build with a copy of itself whose HTML files each have a comment
  appended: every page must come out the same.
- Pixel comparison uses `misMatchThreshold: 0` with `usePreciseMatching`, so
  a one-word change on a long page counts (BackstopJS otherwise rounds the
  mismatch to two decimals). Resemble's per-channel tolerance of 16 still
  ignores imperceptible colour shifts.
- BackstopJS requires Puppeteer when it loads, although the comparison uses
  its Playwright engine. `overrides` in `scripts/visual-diff/package.json`
  pins a Puppeteer release whose dependencies have no known vulnerabilities,
  and `allowScripts` stops Puppeteer downloading its own Chrome.
- `preview.yml` treats the `visual-diff` artifact as untrusted: it publishes
  only static files and reads nothing from it except the four whole-number
  counts in `summary.json`.
