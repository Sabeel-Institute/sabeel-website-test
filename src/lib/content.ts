import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { AreaId } from '../site.config';

export type Program = CollectionEntry<'programs'>;
export type TeamMember = CollectionEntry<'team'>;
export type Instructor = { name: string; role?: string; highlights?: readonly string[]; href?: string };

/* ---------- Programs ---------- */

const newestFirst = (a: Program, b: Program) => b.data.date.getTime() - a.data.date.getTime();
const statusRank = { open: 0, ongoing: 1, upcoming: 2, completed: 3 } as const;

/** Open and ongoing programs: open first, then newest start first. */
export async function getCurrentPrograms(area?: AreaId): Promise<Program[]> {
  const list = await getCollection(
    'programs',
    (p) => (p.data.status === 'open' || p.data.status === 'ongoing') && (!area || p.data.area === area),
  );
  return list.sort((a, b) => statusRank[a.data.status] - statusRank[b.data.status] || newestFirst(a, b));
}

export async function getUpcomingPrograms(area?: AreaId): Promise<Program[]> {
  const list = await getCollection('programs', (p) => p.data.status === 'upcoming' && (!area || p.data.area === area));
  return list.sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
}

export async function getCompletedPrograms(area?: AreaId): Promise<Program[]> {
  const list = await getCollection('programs', (p) => p.data.status === 'completed' && (!area || p.data.area === area));
  return list.sort(newestFirst);
}

/** Where a program lives: its bespoke page, or the standard template page. */
export function programHref(program: Program): string {
  return program.data.page ?? `/programs/${program.id}/`;
}

export const STATUS_LABEL = {
  open: 'Registration open',
  ongoing: 'Ongoing series',
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

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
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
