import type { Validator } from '@/validator';

export type Type =
| { kind: 'ref', ref: Validator }
| { kind: 'name', name: string, args: readonly Type[] }
| { kind: 'string', value: string }
| { kind: 'union', members: readonly Type[] }
| { kind: 'tuple', items: readonly Type[] }
;

export function name(name: string, ...args: Type[]): Type {
  return { kind: 'name', name, args } as const;
}

export function union(...members: readonly (Type | undefined)[]) {
  const filtered = members.filter(m => m !== undefined) as Type[];
  if (filtered.length === 0) {
    throw new Error();
  } else if (filtered.length === 1) {
    return filtered[0];
  } else {
    return {
      kind: 'union',
      members: filtered as Type[],
    } as const;
  }
}

export function tuple(...items: readonly Type[]) {
  return {
    kind: 'tuple',
    items,
  } as const;
}

export const builtin = {
  string: name('string'),
  any: name('any'),
} as const;
