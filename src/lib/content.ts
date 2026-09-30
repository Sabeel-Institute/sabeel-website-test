import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { AreaId } from '../site.config';

export type Program = CollectionEntry<'programs'>;
export type TeamMember = CollectionEntry<'team'>;
export type Instructor = { name: string; role?: string; highlights?: readonly string[]; href?: string };

/* ---------- Programs ---------- */

type Status = Program['data']['status'];

const newestFirst = (a: Program, b: Program) => b.data.date.getTime() - a.data.date.getTime();
const statusRank: Record<Status, number> = { open: 0, ongoing: 1, closed: 2, upcoming: 3, completed: 4 };

const withStatus = (statuses: readonly Status[], area?: AreaId) =>
  getCollection('programs', (p) => statuses.includes(p.data.status) && (!area || p.data.area === area));

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
  Object.keys(import.meta.glob('/src/pages/**/*.astro')).map((file) =>
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
