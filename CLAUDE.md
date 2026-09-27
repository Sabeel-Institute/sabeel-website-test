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
- Past-program titles, dates, and summaries were transcribed from the flyers on
  oursabeel.com/past-courses. `dateApprox: true` marks entries whose year was
  inferred from the flyer's weekday and upload month.
- `firebase.json` redirects the earlier paths (`/courses/`, `/our-team/`,
  `/seminary/`, `/donate/`) and the old WordPress paths to their new pages.
