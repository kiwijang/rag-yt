export type ClassValue =
  | string
  | false
  | null
  | undefined
  | readonly ClassValue[]
  | Readonly<Record<string, unknown>>;

const utilityGroups: readonly [string, RegExp][] = [
  ['display', /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents|hidden)$/],
  ['font-size', /^text-(?:xs|sm|base|lg|xl|[2-9]xl)(?:\/.*)?$/],
  ['text-align', /^text-(?:left|center|right|justify|start|end)$/],
  ['font-weight', /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/],
  ['border-width', /^border(?:-[0248])?$/],
  ['border-style', /^border-(?:solid|dashed|dotted|double|hidden|none)$/],
  ['ring-width', /^ring(?:-[01248])?$/],
  ['ring-offset-width', /^ring-offset-[01248]$/],
  ['ring-offset-color', /^ring-offset-.+$/],
  ['background-color', /^bg-(?:transparent|current|inherit|black|white|[a-z]+-\d{2,3})(?:\/.*)?$/],
  ['border-color', /^border-(?:transparent|current|inherit|black|white|[a-z]+-\d{2,3})(?:\/.*)?$/],
  ['text-color', /^text-(?:transparent|current|inherit|black|white|[a-z]+-\d{2,3})(?:\/.*)?$/],
  ['ring-color', /^ring-(?:transparent|current|inherit|black|white|[a-z]+-\d{2,3})(?:\/.*)?$/],
  ['radius', /^rounded(?:-(?:none|sm|md|lg|xl|[23]xl|full))?$/],
  ['shadow-size', /^shadow(?:-(?:sm|md|lg|xl|2xl|inner|none))?$/],
  ['decoration-line', /^(?:underline|overline|line-through|no-underline)$/],
  ['transition', /^transition(?:-(?:none|all|colors|opacity|shadow|transform))?$/],
];

const valuePrefixes = /^(size|min-w|max-w|min-h|max-h|w|h|gap-x|gap-y|gap|opacity|tracking|leading|p[xytrblse]?|m[xytrblse]?)-/;
const coveredGroups: Readonly<Record<string, readonly string[]>> = {
  size: ['w', 'h'],
  p: ['px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'],
  px: ['pl', 'pr'],
  py: ['pt', 'pb'],
  m: ['mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me'],
  mx: ['ml', 'mr'],
  my: ['mt', 'mb'],
  gap: ['gap-x', 'gap-y'],
};

function collect(value: ClassValue, tokens: string[]): void {
  if (!value) return;
  if (typeof value === 'string') {
    tokens.push(...value.trim().split(/\s+/).filter(Boolean));
  } else if (Array.isArray(value)) {
    for (const item of value) collect(item, tokens);
  } else {
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled) collect(key, tokens);
    }
  }
}

function splitModifiers(token: string): [string, string] {
  let depth = 0;
  let split = 0;
  for (let index = 0; index < token.length; index++) {
    const character = token[index];
    if (character === '\\') {
      index++;
    } else if (character === '[' || character === '(') {
      depth++;
    } else if (character === ']' || character === ')') {
      depth--;
    } else if (character === ':' && depth === 0) {
      split = index + 1;
    }
  }
  return [token.slice(0, split), token.slice(split)];
}

/** Combines conditional classes and resolves conflicts for the common utilities used by this UI. */
export function cn(...classes: ClassValue[]): string {
  const tokens: string[] = [];
  for (const value of classes) collect(value, tokens);

  const merged = new Map<string, string>();
  for (const token of tokens) {
    const [modifiers, utility] = splitModifiers(token);
    const important = utility.startsWith('!') ? '!' : '';
    const value = utility.slice(important.length).replace(/^-/, '');
    const group = utilityGroups.find(([, pattern]) => pattern.test(value))?.[0]
      ?? value.match(valuePrefixes)?.[1];
    const key = group ? `group:${modifiers}${important}${group}` : `class:${token}`;
    merged.delete(key);
    if (group) {
      for (const covered of coveredGroups[group] ?? []) {
        merged.delete(`group:${modifiers}${important}${covered}`);
      }
    }
    merged.set(key, token);
  }
  return [...merged.values()].join(' ');
}
