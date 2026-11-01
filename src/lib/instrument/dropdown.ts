/**
 * Replaces a select with a styled listbox. The select stays in the page as the
 * source of truth, so without scripts visitors keep the native control.
 * Returns a function that shows the select's current value.
 */
export function dropdown(select: HTMLSelectElement): () => void {
  const options = [...select.options];
  const name = select.closest('label')?.querySelector('span')?.textContent ?? '';
  const box = document.createElement('div');
  box.className = 'dropdown';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<i></i><span></span>';
  const value = trigger.querySelector('span')!;
  const list = document.createElement('ul');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', name);
  list.tabIndex = -1;
  list.hidden = true;
  const items = options.map((option, i) => {
    const item = document.createElement('li');
    item.id = `${select.dataset.param}-option-${i}`;
    item.setAttribute('role', 'option');
    item.dataset.value = option.value;
    item.innerHTML = '<i></i>';
    item.append(option.label);
    list.append(item);
    return item;
  });
  box.append(trigger, list);
  select.after(box);
  select.hidden = true;

  let active = 0;
  const highlight = (index: number) => {
    active = (index + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle('active', i === active));
    list.setAttribute('aria-activedescendant', items[active].id);
  };
  const show = () => {
    value.textContent = `${name}: ${options[select.selectedIndex]?.label ?? ''}`.slice(name.length + 2);
    trigger.setAttribute('aria-label', `${name}: ${value.textContent}`);
    items.forEach((item, i) => item.setAttribute('aria-selected', String(i === select.selectedIndex)));
  };
  const close = (refocus = true) => {
    if (list.hidden) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (refocus) trigger.focus();
  };
  const open = () => {
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    highlight(select.selectedIndex);
    list.focus();
  };
  const choose = (index: number) => {
    close();
    if (index === select.selectedIndex) return;
    select.selectedIndex = index;
    show();
    select.dispatchEvent(new Event('change'));
  };

  // The whole control sits inside a label, which would forward clicks to the select.
  box.addEventListener('click', (event) => event.preventDefault());
  trigger.addEventListener('click', () => (list.hidden ? open() : close()));
  list.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement).closest('li');
    if (item) choose(items.indexOf(item));
  });
  list.addEventListener('pointermove', (event) => {
    const item = (event.target as HTMLElement).closest('li');
    if (item) highlight(items.indexOf(item));
  });
  list.addEventListener('blur', () => close(false));
  // Stopped here so that an open list never steers the rocket.
  list.addEventListener('keydown', (event) => {
    event.stopPropagation();
    const moves: Record<string, () => void> = {
      ArrowDown: () => highlight(active + 1),
      ArrowUp: () => highlight(active - 1),
      Home: () => highlight(0),
      End: () => highlight(items.length - 1),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => close(),
      Tab: () => close(),
    };
    const move = moves[event.key];
    if (!move) return;
    if (event.key !== 'Tab') event.preventDefault();
    move();
  });

  show();
  return show;
}
