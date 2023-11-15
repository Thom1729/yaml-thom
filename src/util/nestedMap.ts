interface BasicMapping {
  get: (key: any) => any;
  set: (key: any, value: any) => void;
}

type MapFactories = readonly (() => BasicMapping)[];

export class NestedMap<TKey extends readonly [unknown, ...unknown[]], TValue> {
  private readonly rootMap: BasicMapping;
  private readonly childFactories: MapFactories;

  constructor(...mapFactories: MapFactories) {
    const [rootFactory, ...childFactories] = mapFactories;
    this.rootMap = rootFactory();
    this.childFactories = childFactories;
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
