export const site = {
  name: 'Seb Zuddas',
  fullName: 'Sebastiano Zuddas',
  role: 'Systems and control engineer',
  location: 'London, UK',
  description:
    'I combine systems thinking with a founders impulse to put engineering to work on real problems in people\'s lives.',
  url: 'https://sebzuddas.com',
  wiki: 'https://wiki.sebzuddas.com',
  substack: 'https://sebzuddas.substack.com',
  feed: 'https://sebzuddas.substack.com/feed',
  gumroad: 'https://sebzuddas.gumroad.com',
  links: [
    { label: 'GitHub', href: 'https://github.com/sebzuddas' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/sebzuddas' },
    { label: 'X', href: 'https://twitter.com/sebzuddas' },
  ],
  analyticsId: 'G-4GKWLFQBB8',
};

/** 'Jul 2024' style dates, in UK English. */
export const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
