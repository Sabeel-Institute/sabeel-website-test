@AGENTS.md

## Maintainer notes

- The program schema (`src/content.config.ts`) types only what the site acts
  on: `status`, `area`, `format`, the schedule, `registration`,
  `financialAid`, `page`, venues, and instructors; what people only read
  (`audience`, `location`, `fee`, `deadline`, `highlight`, `card`) is free
  text, one line or a list. Its `superRefine` requires `schedule` or `date`
  (not both), `summary` until a program is completed, and `format` while it
  is open or ongoing. The program object, a schedule part, an inline guest
  instructor, and the team, venue, testimonial, and gallery photo schemas
  are strict, so a field the schema lacks fails the build (named by
  `unknownField`) instead of being dropped. The `file()` loader keeps each
  entry's `id` in its data, so the venue and testimonial schemas declare it.
  `registration` is `none` or one of two strict objects, `{ zeffy }` and
  `{ link }` (each with `unknownField`, which catches a field indented under
  `registration` by mistake), so a program cannot set two; it alone decides
  what Register does, and `financialAid` (on unless `false`) whether the page
  links to Financial Aid.
  `link` must be `https` and not on zeffy.com, whose forms open in the
  dialog through `zeffy`; the error names which, from the issue's `note`.
  `statusLabel` shows an open program with `registration: none` as “No
  registration needed”. Folder names are validated in `generateId`, and
  `womens-learning` / `youth-children` are reserved for the area pages.
- `assertBespokePages` (`src/lib/content.ts`) runs while program pages are
  generated and fails the build when a `page:` value has no matching file in
  `src/pages/`. Its route list skips files and folders starting with `_`, as
  Astro does, so a published program cannot point at an unbuilt page.
- `src/lib/schedule.ts` checks schedule parts (`checkPart`, from the
  schema's part `superRefine`) and words them (`describeSchedule`, through
  `programSchedule` in `src/lib/content.ts`), so dates, days, times, and
  counts on cards, pages, and the Programs rows come from one source. It
  expands rules with ical.js. Days are UTC midnight, as `z.coerce.date()`
  reads `YYYY-MM-DD`, and times stay Central wall-clock minutes, so wording
  needs no time-zone arithmetic. ical.js silently drops rule parts it does
  not know (`BYDAYS=MO` becomes plain weekly), hence the `RULE_PARTS` list;
  and it skips a DTSTART the rule does not give, which is how a `start` off
  the rule is caught (first occurrence ≠ `start`). It also reads `COUNT=0`
  as endless and lets a malformed `BYDAY` through until the rule is
  iterated, so `ruleProblem` checks whole numbers and `checkPart` catches
  iteration errors. Dates go through the schema's `day`, which takes only
  `YYYY-MM-DD` and holds UTC midnight; `z.coerce.date()` would read
  `2026-9-14` as local midnight. A time may end before it starts only from
  PM to AM, past midnight, or on a multi-day event. The count (“7
  sessions”) is given for one part, or for parts that are plain blocks of
  dates: parts with their own label or venue are tracks or activities, and
  parts after midnight share days with the evening's. `programLocation`
  shows `location`, or the venues' names, and map links for every venue the
  program or its parts name: Google Maps search URLs built from a venue's
  name and address.
- `expect` and `policies` are Markdown, rendered by `renderCardText`
  (`src/lib/content.ts`) with Astro's own processor (`satteri()` from
  `@astrojs/markdown-satteri`, a direct dependency at the version Astro
  uses), so they format like the body. A heading in either fails the build
  there, from the rendered HTML, which catches every heading syntax.
- `draft: true` programs are left out by `withStatus`, which every listing
  query uses, and by `getStaticPaths` in `programs/[slug].astro`, so they get
  no page and no listing. Drafts skip the bespoke-page and image checks.
- `assertProgramImages` (`src/lib/content.ts`) runs in the same place and
  fails the build when a program's `image` is not 16:9 (within 0.02). It
  cannot be a schema rule: `image()` does not know an image's size when the
  schema is checked.
- `src/assets/images/logo.png` is `sabeel-logo.png` from the brand
  repository (`skills/sabeel-brand/logo/`), scaled to 1600 px wide.
  `public/icon-*.png` are its `sabeel-icon.png` design: the calligraphy
  without the wordmark on an ivory tile, rounded for the 32 and 192 px icons
  and square for the 180 px Apple touch icon, which iOS rounds itself.
- `Photo.astro` resolves named slots from `src/assets/photos/` with
  `import.meta.glob`; a missing file renders the geometric fallback, so slots
  never break the build.
- `gallery.yaml` has one entry, `photos`, whose value is the whole list:
  Astro returns a collection's entries sorted by id, so one entry per photo
  would lose the order editors set. `getGalleryPhotos` (`src/lib/content.ts`)
  checks that each photo is WebP and names no draft program while the home
  page builds, because `image()` does not know a file's format when the
  schema is checked.
- `Gallery` never moves on its own: content that moves by itself needs a
  pause control (WCAG 2.2.2), and people choose when to see the next photo.
  Its arrows are disabled, and so hidden, at either end and while every photo
  fits.
- `Header`'s drop-down menus keep their state in the button's
  `aria-expanded`, which shows the menu through `peer-aria-expanded`. Hover
  opens a menu only for a mouse (`pointerType`), so a tap on a touch screen
  follows the item's link; the button opens it for keyboards and touch
  screens and keeps it open until it is pressed again, Escape, or a click or
  focus elsewhere. Escape also closes a menu that hover opened, as WCAG
  1.4.13 asks of content shown on hover.
- `Video` shows its cover as a link rather than a `<video>` with `poster` and
  `controls`: the browser's controls would cover the lower part of the cover
  and its middle, and Chrome shows the length as 0:00 until the file loads.
  The player waits in a `<template>` that a click clones, so the page requests
  neither the video nor its captions before then; the cover's `currentSrc`
  becomes the poster, and since the cover is the video's first frame, nothing
  changes on screen when it starts. The click also sets the caption track's
  mode to `showing`, because browsers weigh `default` against the viewer's own
  caption settings differently. The files are found with root-relative
  `import.meta.glob`, so `mp4Duration` (`src/lib/video.ts`) can open the MP4
  from `process.cwd()`; it reads the `mvhd` box with `node:fs` (hence
  `@types/node`) and fails the build when `mdat` comes before `moov`.
  The wrapper's `aspect-ratio` comes from the cover's size, so a portrait
  video needs no other setting.
- `ZeffyDialog` shows Zeffy's plain embed (`/embed/donation-form/<name>`,
  or `/embed/ticketing/<name>` for a program's `registration.zeffy`) in the
  site's own `<dialog>` and loads it on first open; without a form (an open
  program with no `registration` yet), the same dialog says so; `zeffyForm` in
  `src/site.config.ts` builds a form's page and embed links. Zeffy's pop-up
  script (`embed-form-script.min.js`) is not used: it loads the form in a
  hidden frame on every page view, and its pop-up has no dialog role or
  focus handling. The plain embed scrolls inside a fixed-height frame. Its
  `?modal=true` variant adds a close button on narrow screens, which this
  dialog provides itself. Zeffy takes no amount from a link, so donors
  choose it in its form.
- A past program's schedule follows its flyer, in the year its folder
  names. Where the printed weekday does not fall on the printed date in
  that year, the weekday and month stand and the day moves to the nearest
  one with that weekday in that month (the organisation's rule). A flyer
  with neither a year nor a weekday gives only `date`, so pages show the
  year; one with a start and no end gives its first session only, because a
  completed program's rules must end (`repeatsForever` in the schema's
  `superRefine`; an endless past program would recur forever in a
  calendar). Dates given as nights of Ramadan follow the calculated
  calendar (FCNA), which Sabeel's own flyers match (the 21st night was
  March 30 in 2024 and March 20 in 2025).
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
  page's load event, for every image to be `complete` (`img.decode()` alone
  can reject before an image has loaded, for example when its request is
  replaced), and for fonts, each for at most 10 seconds. If anything is still
  loading it logs the files and calls `window.stop()` (Playwright's
  screenshot otherwise waits for a font that never loads). It then finishes
  or cancels every Web Animation. A
  screenshot that still fails is replaced by BackstopJS with a small
  placeholder, which `run.mjs` detects by its width and reports as "could
  not capture". Each step of the `visual-diff` job has its own time limit
  because a step that times out fails (covered by `continue-on-error`), while
  a job that times out is cancelled, which would stop the preview.
- Pages that differ or fail are captured a second time and the second
  result stands, when there are at most `RECHECK_MAX` (40) of them. On
  GitHub's four-core runners a capture occasionally shows an image not yet
  painted; the second capture clears it.
- The viewports and the 20-page cap are `VIEWPORTS` and `MAX_SHOWN` in
  `run.mjs`; the report's screen switch is generated from `VIEWPORTS`. Update
  the figures in `docs/deployment.md` and AGENTS.md when changing them.
- BackstopJS requires Puppeteer when it loads, although it drives Playwright
  here. `overrides` in `scripts/visual-diff/package.json` pins a Puppeteer
  release whose dependencies have no known vulnerabilities, and
  `allowScripts` (honoured by npm 11.18 and later) stops Puppeteer
  downloading its own Chrome.
- `preview.yml`'s `delete-preview` job runs on `pull_request_target`, which
  GitHub runs from `main` with `ref` set to `refs/heads/main`, so the identity
  pool's condition accepts it. It checks out only `main`'s Firebase settings
  and must never check out or run pull-request code. `deploy-preview` sets its
  channel's `retainedReleaseCount` to 1 through the Hosting API, with the
  access token the auth step mints.
- `preview.yml` treats the `visual-diff` artifact as untrusted: it publishes
  only static files, drops the report if it is over 50 MB, and reads nothing
  from it except the five whole-number counts in `summary.json`, which must
  be the file's only JSON value. Adding a count means changing the key list
  in `preview.yml` in the same pull request.
- Every run of a pull request's report is published at the same preview
  address, and Firebase lets browsers keep files for an hour unless told
  otherwise. So `publish` in `run.mjs` names each report image after a hash of
  its content, and `firebase.json` serves `/_visual-diff/**` with
  `Cache-Control: no-cache`; without them, a reopened report can show an
  earlier run's image under another page's heading.
