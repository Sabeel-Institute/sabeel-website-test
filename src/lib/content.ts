import type { ImageMetadata } from 'astro';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { AreaId } from '../site.config';
import { describeSchedule, type ScheduleText } from './schedule';

export type Program = CollectionEntry<'programs'>;
export type TeamMember = CollectionEntry<'team'>;
export type Instructor = { name: string; role?: string; highlights?: readonly string[]; href?: string };

/* ---------- Programs ---------- */

type Status = Program['data']['status'];

/** A program's first day: from its schedule, or its `date` when it has none. */
export function firstDay(program: Program): Date {
  const { schedule, date } = program.data;
  return schedule ? new Date(Math.min(...schedule.map((p) => +p.start))) : date!;
}

const newestFirst = (a: Program, b: Program) => +firstDay(b) - +firstDay(a);
const statusRank: Record<Status, number> = { open: 0, ongoing: 1, closed: 2, upcoming: 3, completed: 4 };

/** Programs on the site (not drafts) with one of these statuses. */
const withStatus = (statuses: readonly Status[], area?: AreaId) =>
  getCollection(
    'programs',
    (p) => !p.data.draft && statuses.includes(p.data.status) && (!area || p.data.area === area),
  );

/** Programs people can join: open first, then newest start first. */
export async function getCurrentPrograms(area?: AreaId): Promise<Program[]> {
  const list = await withStatus(['open', 'ongoing'], area);
  return list.sort((a, b) => statusRank[a.data.status] - statusRank[b.data.status] || newestFirst(a, b));
}

export async function getUpcomingPrograms(area?: AreaId): Promise<Program[]> {
  const list = await withStatus(['upcoming'], area);
  return list.sort((a, b) => +firstDay(a) - +firstDay(b));
}

/** Running programs whose registration has closed. */
export async function getClosedPrograms(area?: AreaId): Promise<Program[]> {
  return (await withStatus(['closed'], area)).sort(newestFirst);
}

export async function getCompletedPrograms(area?: AreaId): Promise<Program[]> {
  return (await withStatus(['completed'], area)).sort(newestFirst);
}

/** Where a program lives: its bespoke page, or the standard template page. */
export function programHref(program: Program): string {
  return program.data.page ?? `/programs/${program.id}/`;
}

export const STATUS_LABEL = {
  open: 'Registration open',
  ongoing: 'Ongoing series',
  closed: 'Registration closed',
  upcoming: 'Coming soon',
  completed: 'Program completed',
} as const;

/** The status as cards and pages show it; an open program anyone can come to says so. */
export function statusLabel(program: Program): string {
  const { status, registration } = program.data;
  return status === 'open' && registration === 'none' ? 'No registration needed' : STATUS_LABEL[status];
}

/** Lines of text a field holds: one line, or a list of them. */
export const asLines = (value: string | readonly string[] | undefined): string[] => [value ?? []].flat().filter(Boolean);

/**
 * When a program meets, as cards and pages word it (see `describeSchedule`).
 * Without a schedule, only the year of its `date` is known.
 */
export async function programSchedule(program: Program): Promise<ScheduleText> {
  const { schedule, date, status } = program.data;
  if (schedule) {
    const names = new Map((await getCollection('venues')).map((v) => [v.id, v.data.name]));
    return describeSchedule(schedule, (id) => names.get(id)!);
  }
  const year = String(date!.getUTCFullYear());
  return { first: date!, cardDates: status === 'completed' ? year : `Starts ${year}`, cardLines: [], pageDates: year, pageLines: [] };
}

/** A venue address to link to a map; `label` names the venue too when the program meets at several. */
export type Place = { label: string; map: string };

/**
 * Where a program meets: its `location` text, or else its venues' names, and
 * the addresses of every venue it names, its schedule's included, to link to
 * a map.
 */
export async function programLocation(program: Program): Promise<{ lines: string[]; places: Place[] }> {
  const { venue, schedule, location } = program.data;
  const refs = [...[venue ?? []].flat(), ...(schedule ?? []).flatMap((p) => (p.venue ? [p.venue] : []))];
  const ids = [...new Set(refs.map((r) => r.id))];
  const venues = await Promise.all(ids.map(async (id) => (await getEntry('venues', id))!.data));
  const places = venues.flatMap((v) =>
    v.address
      ? [
          {
            label: venues.length > 1 ? `${v.name}, ${v.address}` : v.address,
            map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.name}, ${v.address}`)}`,
          },
        ]
      : [],
  );
  const lines = location ? asLines(location) : venues.length ? [venues.map((v) => v.name).join(' and ')] : [];
  return { lines, places };
}

export function programYear(program: Program): number {
  return firstDay(program).getUTCFullYear();
}

/** Team references become linked names; inline guests pass through. */
export async function resolveInstructors(list: Program['data']['instructors']): Promise<Instructor[]> {
  if (!list) return [];
  return Promise.all(
    list.map(async (item) => {
      if ('name' in item) return item;
      const member = (await getEntry(item))!;
      return {
        name: displayName(member),
        role: member.data.role,
        highlights: member.data.highlights,
        href: teamHasPage(member) ? `/teachers-and-team/${member.id}/` : undefined,
      };
    }),
  );
}

/**
 * Every `page:` a program points to must exist, so a listing can never link to
 * a missing page. Called while the build generates program pages.
 */
const pageRoutes = new Set(
  Object.keys(import.meta.glob('/src/pages/**/*.astro'))
    // Astro builds no page from a file or folder whose name starts with "_".
    .filter((file) => !file.includes('/_'))
    .map((file) =>
      file
        .replace(/^\/src\/pages/, '')
        .replace(/(\/index)?\.astro$/, '/')
        .replace(/\/+$/, '/'),
    ),
);

export function assertBespokePages(programs: Program[]): void {
  for (const p of programs) {
    if (p.data.page && !pageRoutes.has(p.data.page)) {
      throw new Error(
        `Program "${p.id}" sets page: ${p.data.page}, but there is no page file for it in src/pages/. ` +
          `Create src/pages${p.data.page.replace(/\/$/, '')}.astro or remove the page field.`,
      );
    }
  }
}

/** Program images are 16:9 (see Program images in AGENTS.md). */
export function assertProgramImages(programs: Program[]): void {
  for (const p of programs) {
    const img = p.data.image;
    if (img && Math.abs(img.width / img.height - 16 / 9) > 0.02) {
      throw new Error(
        `Program "${p.id}" has an image of ${img.width} × ${img.height} px, which is not 16:9. ` +
          'Use a 16:9 image, for example 1920 × 1080 px (see Program images in AGENTS.md).',
      );
    }
  }
}

/* ---------- Gallery ---------- */

export type GalleryPhoto = {
  image: ImageMetadata;
  alt: string;
  /** The program the photo is from, named under the photo. */
  program?: { title: string; year: number; href: string };
};

/**
 * The home page's photos from past programs, in the order gallery.yaml lists
 * them. Fails the build for a photo that is not WebP or names a draft program
 * (see Gallery in AGENTS.md).
 */
export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  const entry = await getEntry('gallery', 'photos');
  if (!entry) {
    throw new Error('src/content/gallery.yaml needs a photos list, which may be empty: photos: [] (see Gallery in AGENTS.md).');
  }
  return Promise.all(
    entry.data.map(async ({ image, alt, program: ref }) => {
      if (image.format !== 'webp') {
        throw new Error(
          `The gallery photo "${alt}" is a ${image.format.toUpperCase()} file. ` +
            'Convert it to WebP with the command under Gallery in AGENTS.md.',
        );
      }
      if (!ref) return { image, alt };
      const program = (await getEntry(ref))!;
      if (program.data.draft) {
        throw new Error(
          `The gallery photo "${alt}" names program "${program.id}", which is a draft and not on the site. ` +
            'Remove the photo’s program field or publish the program.',
        );
      }
      return { image, alt, program: { title: program.data.title, year: programYear(program), href: programHref(program) } };
    }),
  );
}

/* ---------- Team ---------- */

export async function getTeamGroup(group: TeamMember['data']['group']): Promise<TeamMember[]> {
  const list = await getCollection('team', (m) => m.data.listed && m.data.group === group);
  return list.sort((a, b) => a.data.order - b.data.order);
}

export function teamHasPage(member: TeamMember): boolean {
  return member.data.listed && Boolean(member.body?.trim());
}

export function displayName(member: TeamMember): string {
  return `${member.data.honorific} ${member.data.name}`;
}

/** First `words` words of a Markdown body as plain text. */
export function excerpt(markdown: string | undefined, words = 22): string {
  const text = (markdown ?? '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = text.split(' ');
  return parts.length <= words ? text : `${parts.slice(0, words).join(' ')}…`;
}
