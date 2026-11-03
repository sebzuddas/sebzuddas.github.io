import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sebzuddas.com',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
});
