import { getCollection, type CollectionEntry } from 'astro:content';

/** Posts that are only here so far. Delete each one once it is live on Substack. */
export const movedToSubstack: Record<string, string> = {
  '5-lessons-from-the-worlds-most-ambitious-rooms': 'https://sebzuddas.substack.com/p/5-lessons-from-the-worlds-most-ambitious',
};

export function unlistedPosts(): Promise<CollectionEntry<'writing'>[]> {
  return getCollection('writing', ({ data, id }) => !data.draft && !id.startsWith('drafts/') && !(id in movedToSubstack));
}
