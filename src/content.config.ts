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

/** The three program areas that organise Programs and the archive. */
export const PROGRAM_AREAS = ['hikam-foundations', 'womens-learning', 'youth-children'] as const;

/** Where a program meets. Current programs are grouped by this on Programs and area pages. */
export const PROGRAM_FORMATS = ['Online', 'On-site', 'Online & on-site'] as const;
/** How often a program meets; labels in FREQUENCY_LABEL (src/lib/content.ts). */
export const PROGRAM_FREQUENCIES = ['weekly', 'twice-monthly', 'monthly', 'daily', 'once'] as const;

/** Days, then the time: "Mondays · 12:00–1:30 PM CT", "Last Wednesday · 10:00–10:30 AM CT". */
const SCHEDULE = /^[^\d·]+ · \d{1,2}:\d{2}(?: [AP]M)?–\d{1,2}:\d{2} [AP]M CT$/;
/** Days alone, allowed while a program is upcoming: "Mondays & Thursdays". */
const SCHEDULE_DAYS = /^[^\d·]+$/;
const MONTH = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/;
/** A length without dates: "7 sessions", "10 weeks", "5 days", "2 years". */
const DURATION = /^\d+ (?:sessions?|weeks?|days?|months?|years?)$/;

/** Route segments under /programs/ that belong to pages, not programs. */
const RESERVED_SLUGS = new Set(['womens-learning', 'youth-children']);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
      z.object({
        name: z.string().min(1),
        role: z.string().min(1).optional(),
        highlights: z.array(z.string().min(1)).max(3).optional(),
      }),
    ]);

    const fields = {
      title: z.string().min(1),
      /** Optional tagline under the title. */
      subtitle: z.string().min(1).optional(),
      /** One clear sentence: what students will learn and why it matters. */
      summary: z.string().min(1).max(240),
      area: z.enum(PROGRAM_AREAS),
      /** First session (YYYY-MM-DD). Orders listings and archives. */
      date: z.coerce.date(),
      /** Only the year of `date` is known; pages show the year alone. */
      dateApprox: z.boolean().optional(),
      /** How the start is shown when a plain date does not fit, e.g. "Fall 2026". */
      starts: z.string().min(1).optional(),
      /** Who may attend, e.g. "Adult women" or "Boys 12–16, Girls 13+". */
      audience: z.string().min(1),
      /**
       * Days and time, without dates: "Mondays · 12:00–1:30 PM CT". Past
       * programs keep the schedule they announced, dates included.
       */
      schedule: z.string().min(1),
      format: z.enum(PROGRAM_FORMATS),
      /** How often it meets. */
      frequency: z.enum(PROGRAM_FREQUENCIES),
      /** Length without dates ("7 sessions", "10 weeks"); left out for open-ended gatherings. */
      duration: z
        .string()
        .regex(DURATION, 'duration is the length without dates, e.g. "7 sessions" or "10 weeks" (see Fields in AGENTS.md)')
        .optional(),
      /** Last session (YYYY-MM-DD); the page shows the dates from `date` to here. */
      endDate: z.coerce.date().optional(),
      /** A place in src/content/venues.yaml, or a list of them; needed unless the program is online only. */
      venue: z.union([reference('venues'), z.array(reference('venues')).min(1)]).optional(),
      /** The room at the venue, e.g. "Sabeel Classroom", shown as "Sabeel Classroom at Masjid Istiqlal". */
      room: z.string().min(1).optional(),
      /** The online platform, e.g. "Zoom", shown as "Online via Zoom". */
      platform: z.string().min(1).optional(),
      fee: z.string().min(1),
      registerUrl: z.url(),
      /** Registration deadline as people should read it. */
      deadline: z.string().min(1).optional(),
      /** Materials or prerequisites. */
      prerequisites: z.string().min(1).optional(),
      /** Three to five things students will learn. */
      outcomes: z.array(z.string().min(1)).min(1).max(8).optional(),
      instructors: z.array(instructor).min(1).optional(),
      /** Teaching format, activities, homework, parent role, participation. */
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
    };

    /** Taking registrations now. */
    const open = z.object({ ...fields, status: z.literal('open') });
    /** A running series people can still join. */
    const ongoing = z.object({ ...fields, status: z.literal('ongoing') });
    /** Registration has closed; the program is still running. */
    const closed = z.object({ ...fields, status: z.literal('closed'), registerUrl: fields.registerUrl.optional() });
    /** Announced; registration not open yet. */
    const upcoming = z.object({
      ...fields,
      status: z.literal('upcoming'),
      schedule: fields.schedule.optional(),
      format: fields.format.optional(),
      frequency: fields.frequency.optional(),
      fee: fields.fee.optional(),
      registerUrl: fields.registerUrl.optional(),
    });
    /** Finished; kept as an archive record. */
    const completed = z.object({
      ...fields,
      status: z.literal('completed'),
      summary: fields.summary.optional(),
      audience: fields.audience.optional(),
      schedule: fields.schedule.optional(),
      format: fields.format.optional(),
      frequency: fields.frequency.optional(),
      fee: fields.fee.optional(),
      registerUrl: fields.registerUrl.optional(),
    });
    return z.discriminatedUnion('status', [open, ongoing, closed, upcoming, completed]).superRefine((d, ctx) => {
      if (d.image && !d.imageAlt) {
        ctx.addIssue({ code: 'custom', path: ['imageAlt'], message: 'imageAlt is required when image is set' });
      }
      if (d.status !== 'completed' && d.schedule) {
        const shape = SCHEDULE.test(d.schedule) || (d.status === 'upcoming' && SCHEDULE_DAYS.test(d.schedule));
        if (!shape || MONTH.test(d.schedule)) {
          ctx.addIssue({
            code: 'custom',
            path: ['schedule'],
            message: 'schedule is the days, then the time, without dates: "Mondays · 12:00–1:30 PM CT" (see Fields in AGENTS.md)',
          });
        }
      }
      if ((d.status === 'open' || d.status === 'ongoing' || d.status === 'closed') && d.format !== 'Online' && !d.venue) {
        ctx.addIssue({ code: 'custom', path: ['venue'], message: 'venue is required unless the program is online only' });
      }
      if (d.endDate && d.endDate < d.date) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'endDate is before date' });
      }
    });
  },
});

const team = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/team' }),
  schema: z.object({
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
  }),
});

const testimonials = defineCollection({
  loader: file('src/content/testimonials.yaml'),
  schema: z.object({
    program: z.string().min(1),
    quote: z.string().min(1),
  }),
});

/** Places programs meet; a program names one by its id in `venue`. */
const venues = defineCollection({
  loader: file('src/content/venues.yaml'),
  schema: z.object({
    name: z.string().min(1),
    /** Street address, linked to a map on program pages. Only as the organisation gives it. */
    address: z.string().min(1).optional(),
  }),
});

export const collections = { programs, team, testimonials, venues };
