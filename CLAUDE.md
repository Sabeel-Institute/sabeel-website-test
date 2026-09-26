@AGENTS.md

## Maintainer notes

- Content folder names are validated in `src/content.config.ts`
  (`generateId`); course entries use a discriminated union on `status`, so an
  open course fails the build if any listing field is missing.
- `src/lib/content.ts` checks for blog posts by file presence
  (`import.meta.glob`) so an empty `posts` collection does not emit an
  empty-collection warning on every page.
- The GiveWP donation form on oursabeel.com is linked, not embedded: its iframe
  relies on GiveWP's parent-page resize script and gets clipped elsewhere.
- Past-course titles, dates, and summaries were transcribed from the flyers on
  oursabeel.com/past-courses. Where a flyer printed no year, the year was
  inferred from its weekday and upload month; the archive shows only the year.
- `firebase.json` redirects the old WordPress page paths (`/our-mission/`,
  `/my-courses/`, `/hikam-foundations/`, ...) to their new pages for when the
  domain moves.
