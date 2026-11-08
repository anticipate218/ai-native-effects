/**
 * Generic playground: builds labelled controls from a schema, mirrors them onto the
 * effect's attributes and keeps framework snippets in sync. Every effect page reuses it.
 */
import { initCopyButtons } from './copy';

export type ControlSpec =
  | { type: 'segmented'; attr: string; label: string; options: readonly string[]; value: string }
  | { type: 'select'; attr: string; label: string; options: readonly string[]; value: string }
  | { type: 'color'; attr: string; label: string; value: string }
  | { type: 'range'; attr: string; label: string; min: number; max: number; step: number; value: number; unit?: string }
  | { type: 'toggle'; attr: string; label: string; value: boolean };

export interface PlaygroundOptions {
  element: HTMLElement;
  controls: ControlSpec[];
  /** Attribute values that equal the component defaults are left out of snippets. */
  defaults: Record<string, string>;
  controlsHost: HTMLElement;
  codeHost: HTMLElement;
  /** Builds the code tabs from the non-default attributes. */
  snippets: (attrs: Record<string, string>) => Record<string, string>;
  onChange?: (attr: string, value: string | null) => void;
}

export interface Playground {
  set(attr: string, value: string | boolean | number): void;
}

let uid = 0;

const valueOf = (spec: ControlSpec, raw: string | number | boolean): string | null => {
  if (spec.type === 'toggle') return raw ? '' : null;
  if (spec.type === 'range') return `${raw}${spec.unit ?? ''}`;
  return String(raw);
};

/** Renders `name="value"` pairs for HTML (`jsx` = false) or JSX. */
export function attrString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([name, value]) => (value === '' ? ` ${name}` : ` ${name}="${value}"`))
    .join('');
}

export function mountPlayground(options: PlaygroundOptions): Playground {
  const { element, controls, defaults, controlsHost, codeHost } = options;
  const current = new Map<string, string | null>();
  const syncers = new Map<string, (raw: string | number | boolean) => void>();

  const renderCode = (): void => {
    const attrs: Record<string, string> = {};
    for (const spec of controls) {
      const value = current.get(spec.attr);
      if (value == null) continue;
      if (defaults[spec.attr] !== undefined && defaults[spec.attr] === value) continue;
      attrs[spec.attr] = value;
    }
    const tabs = options.snippets(attrs);
    const selected = codeHost.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.dataset.tab;
    renderTabs(codeHost, tabs, selected);
  };

  const apply = (spec: ControlSpec, raw: string | number | boolean): void => {
    const value = valueOf(spec, raw);
    current.set(spec.attr, value);
    if (value == null) element.removeAttribute(spec.attr);
    else element.setAttribute(spec.attr, value);
    syncers.get(spec.attr)?.(raw);
    options.onChange?.(spec.attr, value);
    renderCode();
  };

  for (const spec of controls) {
    const id = `ctl-${++uid}`;
    const wrap = document.createElement('div');
    wrap.className = 'control';

    if (spec.type === 'segmented') {
      wrap.innerHTML = `<span class="label" id="${id}">${spec.label}</span><div class="segmented" role="group" aria-labelledby="${id}"></div>`;
      const group = wrap.querySelector('.segmented')!;
      for (const option of spec.options) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = option;
        button.dataset.value = option;
        button.addEventListener('click', () => apply(spec, option));
        group.append(button);
      }
      syncers.set(spec.attr, (raw) =>
        group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === raw))),
      );
    } else if (spec.type === 'select') {
      wrap.innerHTML = `<label for="${id}">${spec.label}</label><select id="${id}">${spec.options.map((o) => `<option>${o}</option>`).join('')}</select>`;
      const select = wrap.querySelector('select')!;
      select.addEventListener('change', () => apply(spec, select.value));
      syncers.set(spec.attr, (raw) => (select.value = String(raw)));
    } else if (spec.type === 'color') {
      wrap.innerHTML = `<label for="${id}">${spec.label}</label><div class="color-row"><input id="${id}" type="color"><code></code></div>`;
      const input = wrap.querySelector('input')!;
      const code = wrap.querySelector('code')!;
      input.addEventListener('input', () => apply(spec, input.value));
      syncers.set(spec.attr, (raw) => {
        input.value = String(raw);
        code.textContent = String(raw);
      });
    } else if (spec.type === 'range') {
      wrap.innerHTML = `<label for="${id}">${spec.label}<output for="${id}"></output></label><input id="${id}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
      const input = wrap.querySelector('input')!;
      const output = wrap.querySelector('output')!;
      input.addEventListener('input', () => apply(spec, Number(input.value)));
      syncers.set(spec.attr, (raw) => {
        input.value = String(raw);
        output.textContent = `${raw}${spec.unit ?? '×'}`;
      });
    } else {
      wrap.innerHTML = `<label class="switch"><input id="${id}" type="checkbox"> ${spec.label}</label>`;
      const input = wrap.querySelector('input')!;
      input.addEventListener('change', () => apply(spec, input.checked));
      syncers.set(spec.attr, (raw) => (input.checked = Boolean(raw)));
    }
    controlsHost.append(wrap);
    apply(spec, spec.value);
  }

  return {
    set(attr, raw) {
      const spec = controls.find((c) => c.attr === attr);
      if (spec) apply(spec, raw);
    },
  };
}

function renderTabs(host: HTMLElement, tabs: Record<string, string>, selected?: string): void {
  const names = Object.keys(tabs);
  const active = selected && names.includes(selected) ? selected : names[0]!;
  if (!host.querySelector('.tabs')) {
    host.innerHTML = `<div class="code-head"><div class="tabs" role="tablist" aria-label="Usage examples"></div><button type="button" class="btn small copy" data-copy-from="code-snippet">Copy</button></div><div class="code-body" role="tabpanel" aria-label="Code"><pre tabindex="0"><code id="code-snippet"></code></pre></div>`;
    initCopyButtons(host);
    const list = host.querySelector('.tabs')!;
    for (const name of names) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.dataset.tab = name;
      tab.textContent = name;
      tab.addEventListener('click', () => {
        list.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
        host.dispatchEvent(new CustomEvent('tabchange'));
      });
      list.append(tab);
    }
    host.addEventListener('tabchange', () => renderTabs(host, tabsCache.get(host) ?? tabs));
  }
  tabsCache.set(host, tabs);
  const current = host.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.dataset.tab ?? active;
  host.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String((t as HTMLElement).dataset.tab === current)));
  host.querySelector('#code-snippet')!.textContent = tabs[current] ?? '';
}

const tabsCache = new WeakMap<HTMLElement, Record<string, string>>();
