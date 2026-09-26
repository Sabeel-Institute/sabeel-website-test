import { getCollection, type CollectionEntry } from 'astro:content';

export type Course = CollectionEntry<'courses'>;
export type TeamMember = CollectionEntry<'team'>;
export type Post = CollectionEntry<'posts'>;

/** Checked by file presence so an empty blog does not trigger empty-collection warnings. */
export const hasPosts = Object.keys(import.meta.glob('../content/posts/*.md')).length > 0;

export async function getPosts(): Promise<Post[]> {
  if (!hasPosts) return [];
  return (await getCollection('posts')).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

const newestFirst = (a: Course, b: Course) => b.data.date.getTime() - a.data.date.getTime();

export async function getOpenCourses(): Promise<Course[]> {
  return (await getCollection('courses', (c) => c.data.status === 'open')).sort(newestFirst);
}

export async function getPastCourses(): Promise<Course[]> {
  return (await getCollection('courses', (c) => c.data.status === 'past')).sort(newestFirst);
}

/**
 * Open courses always get a page. Past courses keep theirs only when they have
 * written details, so links shared while a course was open keep working;
 * flyer-only archive entries are shown in the Past Courses lightbox instead.
 */
export function courseHasPage(course: Course): boolean {
  return course.data.status === 'open' || Boolean(course.body?.trim());
}

export const TEAM_GROUPS = [
  {
    key: 'board',
    anchor: 'board',
    title: 'Board of Directors',
    intro: 'The directors who guide Sabeel Institute’s mission and programs.',
  },
  {
    key: 'teachers',
    anchor: 'teachers',
    title: 'Our Teachers',
    intro:
      'At Sabeel Institute, we are dedicated to providing authentic Islamic education to our community through qualified teachers.',
  },
  {
    key: 'admin',
    anchor: 'admin',
    title: 'Admin Staff & Volunteers',
    intro:
      'Our successes are a testament to the tireless efforts and dedication of our administration and volunteer staff. Meet the team behind our achievements.',
  },
] as const satisfies ReadonlyArray<{ key: TeamMember['data']['group']; anchor: string; title: string; intro: string }>;

export async function getTeamGroup(group: TeamMember['data']['group']): Promise<TeamMember[]> {
  return (await getCollection('team', (m) => m.data.group === group)).sort((a, b) => a.data.order - b.data.order);
}

export function teamHasPage(member: TeamMember): boolean {
  return Boolean(member.body?.trim());
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

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
