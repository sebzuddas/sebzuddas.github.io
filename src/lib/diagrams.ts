function palette() {
  const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return {
    fontFamily: token('--f-text'),
    background: token('--plate'),
    primaryColor: token('--plate'),
    primaryBorderColor: token('--plate-ink'),
    primaryTextColor: token('--plate-ink'),
    lineColor: token('--plate-ink'),
    secondaryColor: token('--plate'),
    tertiaryColor: token('--plate'),
    edgeLabelBackground: token('--plate'),
    clusterBkg: token('--plate'),
    clusterBorder: token('--plate-muted'),
  };
}

/** Mermaid is large and cannot measure a closed section, so each diagram draws when it first shows. Without scripts the source stays readable. */
export async function renderDiagrams() {
  const nodes = [...document.querySelectorAll<HTMLElement>('.mermaid')];
  if (!nodes.length) return;
  const sources = new Map(nodes.map((node) => [node, node.textContent ?? '']));
  const shown = new Set<HTMLElement>();
  const draw = async (targets: HTMLElement[]) => {
    if (!targets.length) return;
    const { default: mermaid } = await import('mermaid');
    targets.forEach((node) => {
      node.removeAttribute('data-processed');
      node.textContent = sources.get(node) ?? '';
    });
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables: palette() });
    await mermaid.run({ nodes: targets, suppressErrors: true });
  };
  const drawNew = () => {
    const fresh = nodes.filter((node) => !shown.has(node) && !node.closest('details:not([open])'));
    fresh.forEach((node) => shown.add(node));
    return draw(fresh);
  };
  document.querySelectorAll('details').forEach((section) => section.addEventListener('toggle', drawNew));
  new MutationObserver(() => draw([...shown])).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  await drawNew();
}
