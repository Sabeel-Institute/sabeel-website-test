/**
 * Site-wide settings: contact details, external form links, navigation, and
 * the program areas. Change a value here and every page that shows it updates.
 */
import type { PROGRAM_AREAS } from './content.config';

export const site = {
  name: 'Sabeel Institute',
  tagline: 'Structured, in-person Islamic learning for women in Houston.',
  description:
    'Structured, in-person Islamic learning for women in Houston — from classes and gatherings to sustained study with women trained in the Islamic sciences.',
  email: 'info@oursabeel.com',
  location: 'Houston, Texas',
  zelle: 'oursabeel@gmail.com',
  taxId: '93-2752046',
  social: {
    facebook: 'https://www.facebook.com/sameerainstitute',
    instagram: 'https://www.instagram.com/sabeel_institute',
  },
  financialAidFormUrl: 'https://forms.gle/nNkof3zDuKPUzNkh7',
  /**
   * Online giving. Each designation opens its own form; point them at separate
   * campaign forms when they exist. The chosen amount cannot be passed to the
   * current GiveWP form, so the page shows it for the donor to re-enter.
   */
  giving: {
    home: 'https://oursabeel.com/donate/',
    programs: 'https://oursabeel.com/donate/',
    general: 'https://oursabeel.com/donate/',
  },
  /**
   * The action URL of the Mailchimp embedded form for the newsletter
   * (https://<account>.<dc>.list-manage.com/subscribe/post?u=...&id=...&f_id=...),
   * copied from the form's embed code. The newsletter form submits to it; while
   * null, it opens a pre-filled email. The interest-list form always opens one.
   */
  mailingListAction: null as string | null,
  /** Hikam Foundations program overview PDF; the download button hides while null. */
  hikamOverviewPdf: null as string | null,
} as const;

export type AreaId = (typeof PROGRAM_AREAS)[number];

/** Program areas: names, descriptions, and where each area lives. */
export const areas: Record<
  AreaId,
  { label: string; short: string; description: string; archiveText: string; href: string; icon: 'graduation-cap' | 'book-open' | 'leaf' }
> = {
  'hikam-foundations': {
    label: 'Hikam Foundations',
    short: 'Hikam',
    description: 'A structured two-year grounding in the Islamic sciences for adult women.',
    archiveText: 'Completed cohorts and selected milestones from Sabeel’s structured two-year program.',
    href: '/hikam-foundations/',
    icon: 'graduation-cap',
  },
  'womens-learning': {
    label: 'Women’s Learning',
    short: 'women’s',
    description: 'Short courses, Qur’an gatherings, sacred seasons, and learning for everyday life.',
    archiveText: 'Previous short courses, Qur’an gatherings, sacred-season programs, and sustained learning.',
    href: '/programs/womens-learning/',
    icon: 'book-open',
  },
  'youth-children': {
    label: 'Youth & Children',
    short: 'youth & children’s',
    description: 'Age-appropriate Islamic learning, mentorship, honest conversation, and purposeful activities.',
    archiveText: 'Previous learning, mentorship, seasonal, and age-appropriate next-generation programs.',
    href: '/programs/youth-children/',
    icon: 'leaf',
  },
};

/** `match` lists extra path prefixes that mark the item as the current section. */
export type NavItem = { label: string; href: string; match?: string[] };

export const mainNav: NavItem[] = [
  { label: 'Programs', href: '/programs/', match: ['/past-programs/', '/hikam-foundations/'] },
  { label: 'About', href: '/about/', match: ['/through-the-years/'] },
  { label: 'Teachers & Team', href: '/teachers-and-team/' },
];

export const footerNav: { title: string; links: NavItem[] }[] = [
  {
    title: 'Explore',
    links: [
      { label: 'Programs', href: '/programs/' },
      { label: 'Hikam Foundations', href: '/hikam-foundations/' },
      { label: 'About', href: '/about/' },
      { label: 'Support Our Work', href: '/support/' },
    ],
  },
  {
    title: 'More',
    links: [
      { label: 'Teachers & Team', href: '/teachers-and-team/' },
      { label: 'Past Programs', href: '/past-programs/' },
      { label: 'Through the Years', href: '/through-the-years/' },
      { label: 'Financial Aid', href: '/financial-aid/' },
      { label: 'Contact', href: '/contact/' },
    ],
  },
];
