import type { ToolMeta } from './types';

const modules = import.meta.glob<{ meta: ToolMeta }>('./*/meta.ts', { eager: true });

export const tools: ToolMeta[] = Object.values(modules)
  .map((m) => m.meta)
  .sort((a, b) => a.order - b.order);

export function getTool(slug: string): ToolMeta {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
