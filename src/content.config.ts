/**
 * Content schemas. Every course, team member, testimonial and blog post is
 * validated against these at build time, so a missing or mistyped field fails
 * `npm run build` with a message naming the file and the field.
 *
 * How to add or change content: see AGENTS.md.
 */
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

/** Course categories, as used on the course pages and the past-courses filter. */
export const COURSE_CATEGORIES = [
  'Ladies',
  'Adults',
  'Youth Girls',
  'Youth Boys',
  'Youth',
  'Kids',
  'Families',
  'Everyone',
] as const;

/** Folder-per-entry collections use the folder name as the id and URL slug. */
const folderId = ({ entry }: { entry: string }) => entry.split('/')[0]!;

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const courses = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/courses',
    generateId: (o) => {
      const id = folderId(o);
      if (!slugPattern.test(id)) {
        throw new Error(
          `Course folder "${id}" must be lowercase words joined by hyphens, e.g. "mommy-burnout-2026".`,
        );
      }
      return id;
    },
  }),
  schema: ({ image }) => {
    const openCourse = z.object({
      /** "open" = shown under Open for Registration; "past" = shown in the Past Courses archive. */
      status: z.literal('open'),
      title: z.string().min(1),
      /** Short line shown under the title, e.g. "A Journey from Burnout to Barakah". */
      subtitle: z.string().min(1).optional(),
      /** One or two sentences for course cards and link previews. */
      summary: z.string().min(1).max(240),
      category: z.enum(COURSE_CATEGORIES),
      /** Date of the first session (YYYY-MM-DD). Orders course listings, newest first. */
      date: z.coerce.date(),
      /** Schedule as people should read it, e.g. "Mondays, Sept 14 – Oct 26". */
      dates: z.string().min(1),
      time: z.string().min(1),
      venue: z.string().min(1),
      /** Who may attend, e.g. "Ladies only" or "Boys 12–16, Girls 13+". */
      audience: z.string().min(1),
      fee: z.string().min(1),
      /** Registration form link (Google Forms etc.). */
      registerUrl: z.url(),
      /** Flyer image in the same folder, e.g. "./flyer.webp". */
      flyer: image(),
    });
    const pastCourse = openCourse.partial().extend({
      status: z.literal('past'),
      title: z.string().min(1),
      category: z.enum(COURSE_CATEGORIES),
      date: z.coerce.date(),
      flyer: image(),
    });
    return z.discriminatedUnion('status', [openCourse, pastCourse]);
  },
});

const team = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/team' }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(1),
      honorific: z.enum(['Ustadhah', 'Sr.', 'Br.', 'Dr.']),
      /** Section on the Our Team page. */
      group: z.enum(['board', 'teachers', 'admin']),
      /** Position within the group, ascending. */
      order: z.number().int(),
      /** Optional role line, e.g. "Founder" or "Treasurer". */
      role: z.string().min(1).optional(),
      photo: image().optional(),
    }),
});

const testimonials = defineCollection({
  loader: file('src/content/testimonials.yaml'),
  schema: z.object({
    program: z.string().min(1),
    quote: z.string().min(1),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      date: z.coerce.date(),
      summary: z.string().min(1).max(240),
      author: z.string().min(1).optional(),
      cover: image().optional(),
    }),
});

export const collections = { courses, team, testimonials, posts };
