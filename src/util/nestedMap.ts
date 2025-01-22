interface BasicMapping {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  has: (key: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (key: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (key: any, value: any) => void;
}

type MapFactories<TKey extends readonly unknown[]> =
  TKey extends [unknown, ...infer Rest]
    ? [() => BasicMapping, ...MapFactories<Rest>]
    : [];

export class NestedMap<TKey extends readonly [unknown, ...unknown[]], TValue> {
  private readonly rootMap: BasicMapping;
  private readonly childFactories: (() => BasicMapping)[];

  constructor(...mapFactories: MapFactories<TKey>) {
    const [rootFactory, ...childFactories] = mapFactories as (() => BasicMapping)[];
    this.rootMap = rootFactory();
    this.childFactories = childFactories;
  }

  has(...key: TKey): boolean {
    let x = this.rootMap;

    for (const k of key) {
      if (!x.has(k)) return false;
      x = x.get(k);
    }

    return true;
  }

  get(...key: TKey) {
    let x = this.rootMap;

    for (const k of key) {
      x = x.get(k);
      if (x === undefined) return undefined;
    }

    return x as TValue;
  }

  set(...args: [...TKey, TValue]) {
    const leadingKeys = args.slice(0, -2);
    const lastKey = args[args.length - 2];
    const value = args[args.length - 1];

    let map = this.rootMap;

    for (let i = 0; i < leadingKeys.length; i++) {
      let nextMap = map.get(leadingKeys[i]);
      if (nextMap === undefined) {
        nextMap = this.childFactories[i]();
        map.set(leadingKeys[i], nextMap);
      }
      map = nextMap;
    }

    map.set(lastKey, value);
  }
}
