import type { Validator } from '@/validator';

export type Type =
| { kind: 'ref', ref: Validator }
| { kind: 'string', value: string }
| { kind: 'name', name: string, children: readonly Type[] }
| { kind: 'union', children: readonly [Type, ...Type[]] }
| { kind: 'tuple', children: readonly Type[] }
;

export function name(name: string, ...args: Type[]): Type {
  return { kind: 'name', name, children: args } as const;
}

export function string(value: string): Type {
  return { kind: 'string', value };
}

export function union(...members: readonly (Type | undefined)[]): Type {
  const filtered = members.filter(m => m !== undefined) as Type[];
  if (filtered.length === 0) {
    throw new TypeError('Empty union');
  // } else if (filtered.length === 1) {
    // return filtered[0];
  } else {
    return {
      kind: 'union',
      children: filtered as readonly Type[] as readonly [Type, ...Type[]],
    } as const;
  }
}

export function tuple(...items: readonly Type[]): Type {
  return {
    kind: 'tuple',
    children: items,
  } as const;
}

export const builtin = {
  string: name('string'),
  any: name('any'),
} as const;
