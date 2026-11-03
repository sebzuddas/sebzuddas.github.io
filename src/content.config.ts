import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { projectEntries } from './lib/providers/github';
import { resourceEntries } from './lib/providers/gumroad';
import { categories, type Category } from './lib/resources';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string().nullish(),
    date: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string(), description: z.string().optional(), poster: z.string().optional(), posterAlt: z.string().optional() }),
});

const projects = defineCollection({
  loader: projectEntries,
  schema: z.object({
    title: z.string(),
    summary: z.string().optional(),
    method: z.string().optional(),
    /** Omit when the project has no page. */
    href: z.string().optional(),
    order: z.number(),
    pin: z.number().optional(),
    repo: z.string().optional(),
    /** The README, compiled and formatted for the page. */
    readme: z.string().optional(),
    stats: z.object({ sections: z.number(), figures: z.number(), equations: z.number(), diagrams: z.number() }).optional(),
    site: z.string().optional(),
    embed: z.boolean().default(false),
    pushed: z.string().optional(),
  }),
});

const resources = defineCollection({
  loader: resourceEntries,
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum(Object.keys(categories) as [Category, ...Category[]]),
    audience: z.string().optional(),
    tier: z.enum(['open', 'long']),
    delivery: z.object({
      provider: z.enum(['gumroad', 'substack']),
      url: z.string().url(),
      price: z.string().optional(),
    }),
  }),
});

export const collections = { writing, pages, projects, resources };
