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
  `docs/deployment.md`) skips pages whose HTML is identical in both builds,
  unless some other file differs. That relies on Astro naming what it
  generates under `_astro/` after a hash, so a changed asset changes the
  HTML that loads it; if `build.assets` or the asset naming changes, update
  `classifyPages` in `run.mjs`. Tailwind reads class names only from `src/`
  outside `src/content/` (top of `global.css`), so content, docs, and tooling
  edits leave the stylesheet, and with it every other page's HTML, unchanged.
- BackstopJS only takes the screenshots (its `reference` command, both
  builds in one run); pixelmatch compares them exactly (threshold 0,
  anti-aliasing counted), after padding both to the larger size. Exact
  comparison works because capture is repeatable: screenshots use the
  Chromium build that matches the Playwright version in
  `scripts/visual-diff/package-lock.json`, not the system Chrome, which lays
  some full-page screenshots out at the wrong width when its version is far
  from Playwright's. To check repeatability, compare a build with a copy of
  itself whose HTML files each have a comment appended: every page must come
  out the same.
- `engine/before.cjs` sets reduced motion, a fixed clock, and a seeded
  `Math.random` before each page loads. `engine/ready.cjs` waits for the
  page's load event, its images, and its fonts, each for at most 10 seconds,
  then calls `window.stop()` (Playwright's screenshot otherwise waits for a
  font that never loads) and finishes or cancels every Web Animation. A
  screenshot that still fails is replaced by BackstopJS with a small
  placeholder, which `run.mjs` detects by its width and reports as "could
  not capture". Each step of the `visual-diff` job has its own time limit
  because a step that times out fails (covered by `continue-on-error`), while
  a job that times out is cancelled, which would stop the preview.
- The viewports and the 20-page cap are `VIEWPORTS` and `MAX_SHOWN` in
  `run.mjs`; the report's screen switch is generated from `VIEWPORTS`. Update
  the figures in `docs/deployment.md` and AGENTS.md when changing them.
- BackstopJS requires Puppeteer when it loads, although it drives Playwright
  here. `overrides` in `scripts/visual-diff/package.json` pins a Puppeteer
  release whose dependencies have no known vulnerabilities, and
  `allowScripts` (honoured by npm 11.18 and later) stops Puppeteer
  downloading its own Chrome.
- `preview.yml` treats the `visual-diff` artifact as untrusted: it publishes
  only static files, drops the report if it is over 50 MB, and reads nothing
  from it except the five whole-number counts in `summary.json`, which must
  be the file's only JSON value. Adding a count means changing the key list
  in `preview.yml` in the same pull request.
