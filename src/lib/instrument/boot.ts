import { getTool } from '../../tools/registry';
import { createContext, type Mount } from './runtime';

const views = import.meta.glob<{ mount: Mount }>('../../tools/*/view.ts');

async function start(root: HTMLElement) {
  const slug = root.dataset.tool!;
  try {
    const meta = getTool(slug);
    const load = views[`../../tools/${slug}/view.ts`];
    const { mount } = await load();
    mount(createContext(root, meta));
  } catch (error) {
    root.dataset.state = 'failed';
    console.error(error);
  }
}

document.querySelectorAll<HTMLElement>('[data-tool]').forEach(start);
