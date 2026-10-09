/**
 * Content schemas. Every program, team member, testimonial, and venue is
 * validated against these at build time, so a missing or mistyped field fails
 * `npm run build` with a message naming the file and the field.
 *
 * How to add or change content: see AGENTS.md.
 */
import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { checkPart, repeatsForever } from './lib/schedule';

/** The three program areas that organise Programs and the archive. */
export const PROGRAM_AREAS = ['hikam-foundations', 'womens-learning', 'youth-children'] as const;

/** Where a program meets. Current programs are grouped by this on Programs and area pages. */
export const PROGRAM_FORMATS = ['Online', 'On-site', 'Online & on-site'] as const;

const PROGRAM_STATUSES = ['open', 'ongoing', 'closed', 'upcoming', 'completed'] as const;

/** Route segments under /programs/ that belong to pages, not programs. */
const RESERVED_SLUGS = new Set(['womens-learning', 'youth-children']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Names a field the schema lacks, so a misspelt field fails the build instead of being dropped. */
const unknownField = (what: string) => ({
  error: (issue: { code?: string; keys?: string[] }) =>
    issue.code === 'unrecognized_keys' ? `${issue.keys?.join(', ')}: not a ${what} field (see AGENTS.md)` : undefined,
});

/**
 * Text people read: one line, or a list of lines. In YAML, a line that
 * contains ": " is read as a field unless it is in quotes, hence the hint.
 */
const lines = (field: string) =>
  z.union([z.string().min(1), z.array(z.string().min(1)).min(1)], {
    error: `${field} is a line of text or a list of lines; put a line that contains ": " in quotes`,
  });

/**
 * A calendar day, written YYYY-MM-DD, held as UTC midnight: what YAML makes
 * of an unquoted one, so a date reads the same in every time zone.
 */
const DAY_FORM = 'a date is written YYYY-MM-DD, e.g. 2026-09-14';
const isDay = (v: string) => {
  const d = new Date(`${v}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(+d) && d.toISOString().startsWith(v);
};
const day = z
  .union([z.date(), z.string().refine(isDay, DAY_FORM)], { error: DAY_FORM })
  .transform((v) => (typeof v === 'string' ? new Date(`${v}T00:00:00Z`) : v))
  .refine((d) => d.toISOString().endsWith('T00:00:00.000Z'), DAY_FORM);

const programs = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/programs',
    generateId: ({ entry }) => {
      const id = entry.split('/')[0]!;
      if (!slugPattern.test(id)) {
        throw new Error(`Program folder "${id}" must be lowercase words joined by hyphens, e.g. "mommy-burnout-2026".`);
      }
      if (RESERVED_SLUGS.has(id)) {
        throw new Error(`Program folder "${id}" is reserved for a program-area page; choose another name.`);
      }
      return id;
    },
  }),
  schema: ({ image }) => {
    /** A team member id (file name in src/content/team) or a guest written inline. */
    const instructor = z.union([
      reference('team'),
      z.strictObject({
        name: z.string().min(1),
        role: z.string().min(1).optional(),
        highlights: z.array(z.string().min(1)).max(3).optional(),
      }, unknownField('guest instructor')),
    ], {
      error: 'an instructor is a team file name (sameera-shah), or a guest with name:, and optionally role: and highlights: (see Fields in AGENTS.md)',
    });

    /**
     * One part of a schedule: a first day, and optionally a time, a repeat
     * rule (iCalendar RRULE), dates to skip, or the last day of one
     * continuous multi-day event (see Schedule in AGENTS.md).
     */
    const part = z
      .strictObject({
        /** First day (YYYY-MM-DD). */
        start: day,
        /** Last day of one continuous multi-day event, such as a camping trip. */
        end: day.optional(),
        /** Central time as people read it: "12:00–1:30 PM", "10:00 AM–1:00 PM", "6:00 PM". */
        time: z.string().min(1).optional(),
        /** How it repeats: FREQ=WEEKLY;BYDAY=MO;COUNT=7. */
        repeat: z.string().min(1).optional(),
        /** Dates the rule gives that do not take place. */
        skip: z.array(day).min(1).optional(),
        /** Where this part meets, when not at the program's venue. */
        venue: reference('venues').optional(),
        /** A few words that set this part apart: "Book club", "Girls 14+". */
        label: z.string().min(1).optional(),
      }, unknownField('schedule part'))
      .superRefine((p, ctx) => {
        // Zod runs this even when a field failed; its dates are only usable once they parsed.
        if (![p.start, p.end ?? p.start, ...(p.skip ?? [])].every((d) => d instanceof Date)) return;
        for (const [field, message] of checkPart(p)) ctx.addIssue({ code: 'custom', path: [field], message });
      });

    return z
      .strictObject({
        status: z.enum(PROGRAM_STATUSES),
        title: z.string().min(1),
        /** Optional tagline under the title. */
        subtitle: z.string().min(1).optional(),
        /** One clear sentence: what students will learn and why it matters. Used in link previews. */
        summary: z.string().min(1).optional(),
        area: z.enum(PROGRAM_AREAS),
        /** When it meets: one part, or several (see Schedule in AGENTS.md). */
        schedule: z.array(part).min(1).optional(),
        /** Without a schedule: the first day, or a best guess (YYYY-MM-DD). Pages show its year. */
        date: day.optional(),
        /** Who may attend, e.g. "Adult women" or "Boys 12–16 · Girls 13+". */
        audience: lines('audience').optional(),
        format: z.enum(PROGRAM_FORMATS).optional(),
        /** A place in src/content/venues.yaml, or a list of them; each gets a map link. */
        venue: z.union([reference('venues'), z.array(reference('venues')).min(1)]).optional(),
        /** Where it meets, as the page says it: "Sabeel Classroom at Masjid Istiqlal or online via Zoom". */
        location: lines('location').optional(),
        /** Price as people should read it, e.g. "$150", or one line per price. */
        fee: lines('fee').optional(),
        /** false leaves out the Financial aid link under the fee, for a free program. */
        financialAid: z.boolean().default(true),
        /**
         * How people join: `{ zeffy: <name> }`, the Zeffy ticketing form named
         * after /ticketing/ in its links, which Register opens in a dialog;
         * `{ link: <https url> }`, another site's form, which it opens in a new
         * tab; or `none`, for a program anyone can come to. Left out,
         * Register says the form is a work in progress.
         */
        registration: z
          .union(
            [
              z.literal('none'),
              z.strictObject({
                zeffy: z.string().regex(slugPattern, 'zeffy is the name after /ticketing/ in the Zeffy form links, e.g. "anchored-hearts-sisters-circle"'),
              }, unknownField('registration')),
              z.strictObject({
                link: z.url({
                  protocol: /^https$/,
                  // A Zeffy form opens in the site's dialog, so it is `zeffy`, never `link`.
                  hostname: /^(?!(?:.+\.)?zeffy\.com$)/,
                  error: (issue) =>
                    'note' in issue && issue.note === 'Invalid hostname'
                      ? 'a Zeffy form is not a link: write zeffy: <the name after /ticketing/ in its links> (see Registration in AGENTS.md)'
                      : 'link is the form\'s full address, starting with https://',
                }),
              }, unknownField('registration')),
            ],
            {
              error:
                'registration is none, or has one line under it: zeffy: <the name after /ticketing/ in the Zeffy ' +
                'form links>, or link: <the address of another site\'s form> (see Registration in AGENTS.md)',
            },
          )
          .optional(),
        /** Registration deadline as people should read it. */
        deadline: lines('deadline').optional(),
        /** A short line in bold above the Register button: an early-bird price, limited seats, a new date. */
        highlight: z.string().min(1).optional(),
        /** One or two lines a card, or a Programs list, shows in place of its dates and times. */
        card: z.union([z.string().min(1), z.array(z.string().min(1)).min(1).max(2)]).optional(),
        /** Three to five things students will learn. */
        outcomes: z.array(z.string().min(1)).min(1).max(8).optional(),
        instructors: z.array(instructor).min(1).optional(),
        /** Teaching format, activities, homework, parent role, participation, and anything to bring or know first. */
        expect: z.string().min(1).optional(),
        /** Attendance, refunds, recording, accessibility, safeguarding. */
        policies: z.string().min(1).optional(),
        /**
         * The program image: a 16:9 photograph or artwork (1920 × 1080 px), shown
         * on its card, at the top of its page, and in link previews.
         */
        image: image().optional(),
        imageAlt: z.string().min(1).optional(),
        /** The original flyer, US Letter portrait (2550 × 3300 px), shown lower on the page. */
        flyer: image().optional(),
        /** true keeps the program in the repository but off the site: no page and no listing. */
        draft: z.boolean().optional(),
        /**
         * Bespoke page path (e.g. "/hikam-foundations/"). When set, listings link
         * there and the standard template does not render this program.
         */
        page: z
          .string()
          .regex(/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/$/, 'page must look like "/hikam-foundations/"')
          .optional(),
      }, unknownField('program'))
      .superRefine((d, ctx) => {
        const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
        if (d.image && !d.imageAlt) issue('imageAlt', 'imageAlt is required when image is set');
        if (!d.schedule && !d.date) issue('schedule', 'give the program a schedule, or a date when its schedule is not known (see Schedule in AGENTS.md)');
        if (d.schedule && d.date) issue('date', 'a program with a schedule takes its date from it: remove date');
        if (d.status !== 'completed' && !d.summary) issue('summary', 'summary is required until the program is completed');
        if ((d.status === 'open' || d.status === 'ongoing') && !d.format) issue('format', 'format is required while people can join: it decides where the program is listed');
        if (d.status === 'completed' && d.schedule?.some(repeatsForever)) {
          issue('schedule', 'a completed program\'s schedule ends: give its repeat COUNT or UNTIL, or keep only the first session');
        }
      });
  },
});

const team = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/team' }),
  schema: z.strictObject({
    name: z.string().min(1),
    honorific: z.enum(['Ustadhah', 'Ust.', 'Sr.', 'Br.', 'Dr.']),
    /** Section on the Teachers & Team page. */
    group: z.enum(['founder', 'board', 'teachers', 'volunteers']),
    /** Position within the group, ascending. */
    order: z.number().int(),
    /** e.g. "Program Director and Teacher". */
    role: z.string().min(1).optional(),
    /** Optional subtitle below the main role/title. */
    sub: z.string().min(1).optional(),
    /** The short bio under the name: studies and degrees, one short line each ("Sabeel Graduate", "‘Alimiyyah"). The body is the long bio. */
    highlights: z.array(z.string().min(1)).max(3).optional(),
    /** false keeps the file but hides the person from the site. */
    listed: z.boolean().default(true),
  }, unknownField('team')),
});

const testimonials = defineCollection({
  loader: file('src/content/testimonials.yaml'),
  schema: z.strictObject({
    /** Unique; what tells the quotes apart. */
    id: z.string().min(1),
    program: z.string().min(1),
    quote: z.string().min(1),
  }, unknownField('testimonial')),
});

/** Places programs meet; a program names one by its id in `venue`. */
const venues = defineCollection({
  loader: file('src/content/venues.yaml'),
  schema: z.strictObject({
    /** What programs write in `venue`, e.g. "masjid-istiqlal". */
    id: z.string().min(1),
    name: z.string().min(1),
    /** Street address, linked to a map on program pages. Only as the organisation gives it. */
    address: z.string().min(1).optional(),
  }, unknownField('venue')),
});

/**
 * Photos from past programs, shown in a row near the bottom of the home page.
 * The file's one entry, `photos`, is a list, so the row keeps its order:
 * entries of a collection come back sorted by id.
 */
const gallery = defineCollection({
  loader: file('src/content/gallery.yaml'),
  schema: ({ image }) =>
    z.array(
      z.strictObject({
        /** The photo: a WebP file in src/content/gallery/. */
        image: image(),
        /** What the photo shows, for people who cannot see it. */
        alt: z.string().min(1),
        /** The program the photo is from; its name and year, linked to its page, go under the photo. */
        program: reference('programs').optional(),
      }, unknownField('gallery photo')),
    ),
});

export const collections = { programs, team, testimonials, venues, gallery };
