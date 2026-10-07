import type { ImageMetadata } from 'astro';
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { AreaId } from '../site.config';
import type { PROGRAM_FREQUENCIES } from '../content.config';

export type Program = CollectionEntry<'programs'>;
export type TeamMember = CollectionEntry<'team'>;
export type Instructor = { name: string; role?: string; highlights?: readonly string[]; href?: string };

/* ---------- Programs ---------- */

type Status = Program['data']['status'];

const newestFirst = (a: Program, b: Program) => b.data.date.getTime() - a.data.date.getTime();
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
  return list.sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
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

const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

export const FREQUENCY_LABEL: Record<(typeof PROGRAM_FREQUENCIES)[number], string> = {
  weekly: 'Weekly',
  'twice-monthly': 'Twice a month',
  monthly: 'Monthly',
  daily: 'Daily',
  once: 'One session',
};

/** How often and how long: "Weekly · 7 sessions", "Monthly". */
export function rhythmLabel(program: Program): string | undefined {
  const { frequency, duration } = program.data;
  return [frequency && FREQUENCY_LABEL[frequency], duration].filter(Boolean).join(' · ') || undefined;
}

const MONTHS = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/** First to last session, "Sept 14 – Oct 26"; nothing without an end date. */
export function dateRange(program: Program): string | undefined {
  const { date, endDate } = program.data;
  if (!endDate) return undefined;
  const withYear = date.getUTCFullYear() !== endDate.getUTCFullYear();
  const show = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${withYear ? `, ${d.getUTCFullYear()}` : ''}`;
  return `${show(date)} – ${show(endDate)}`;
}

/** A venue address to link to a map; `label` names the venue too when the program meets at several. */
export type Place = { label: string; map: string };

/**
 * Where a program meets, as its page says it ("Sabeel Classroom at Masjid
 * Istiqlal", "Masjid Istiqlal or online via Zoom"), and the venue addresses to
 * link to a map.
 */
export async function resolveLocation(program: Program): Promise<{ text: string; places: Place[] } | undefined> {
  const { venue, room, platform, format } = program.data;
  const venues = await Promise.all([venue ?? []].flat().map(async (ref) => (await getEntry(ref))!.data));
  // A program's own room applies to its one venue; otherwise each venue shows the room programs meet in there.
  const onSite = venues
    .map((v) => {
      const at = (venues.length === 1 && room) || v.room;
      return at ? `${at} at ${v.name}` : v.name;
    })
    .join(' and ');
  const isOnline = format ? format !== 'On-site' : Boolean(platform);
  const online = isOnline ? (platform ? `online via ${platform}` : 'online') : '';
  const text = onSite && online ? `${onSite} or ${online}` : onSite || online.charAt(0).toUpperCase() + online.slice(1);
  if (!text) return undefined;
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
  return { text, places };
}

/** The start as people should read it. */
export function startLabel(program: Program): string {
  const d = program.data;
  if (d.starts) return d.starts;
  return d.dateApprox ? String(d.date.getUTCFullYear()) : longDate.format(d.date);
}

export function programYear(program: Program): number {
  return program.data.date.getUTCFullYear();
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
