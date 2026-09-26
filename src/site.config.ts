/**
 * Site-wide settings: contact details, external form links, navigation.
 * Change a value here and every page that shows it updates.
 */
export const site = {
  name: 'Sabeel Institute',
  description:
    'Structured, in-person Islamic learning for women in Houston — from classes and gatherings to sustained study with women trained in the Islamic sciences.',
  email: 'info@oursabeel.com',
  location: 'Houston, TX',
  zelle: 'oursabeel@gmail.com',
  taxId: '93-2752046',
  social: {
    facebook: 'https://www.facebook.com/sameerainstitute',
    instagram: 'https://www.instagram.com/sabeel_institute',
  },
  /** Online donation form (GiveWP on oursabeel.com: card, bank, recurring). */
  donationFormUrl: 'https://oursabeel.com/donate/',
  financialAidFormUrl: 'https://forms.gle/nNkof3zDuKPUzNkh7',
  /**
   * Mailchimp embedded-form action URL
   * (https://<dc>.list-manage.com/subscribe/post?u=...&id=...).
   * While null, the newsletter form opens a pre-filled email to `email` instead.
   */
  newsletterFormAction: null as string | null,
} as const;

export type NavItem = { label: string; href: string };

/** Header navigation. The Blog link is added automatically once a post exists. */
export const mainNav: NavItem[] = [
  { label: 'About', href: '/about/' },
  { label: 'Seminary', href: '/seminary/' },
  { label: 'Courses', href: '/courses/' },
  { label: 'Past Courses', href: '/past-courses/' },
  { label: 'Our Team', href: '/our-team/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Contact', href: '/contact/' },
];

/** Footer quick links (two columns). */
export const footerNav: NavItem[] = [
  { label: 'About', href: '/about/' },
  { label: 'Seminary', href: '/seminary/' },
  { label: 'Courses', href: '/courses/' },
  { label: 'Past Courses', href: '/past-courses/' },
  { label: 'Our Team', href: '/our-team/' },
  { label: 'Blog', href: '/blog/' },
  { label: 'Financial Aid', href: '/financial-aid/' },
  { label: 'Testimonials', href: '/testimonials/' },
  { label: 'Contact', href: '/contact/' },
];
