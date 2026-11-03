/** Resource categories, each with a page at /resources/<key>/ once it has entries. Tools are separate: they come from the tool registry. Add a category here. */
export const categories = {
  lists: { title: 'Lists', lede: 'Reading lists and reference lists for engineers and systems thinkers.' },
} as const;

export type Category = keyof typeof categories;
