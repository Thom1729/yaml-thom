export class WeakCache<TKey extends readonly [object, ...object[]], TValue> {
  map = new WeakMap();

  get(...key: TKey) {
    let x = this.map;

    for (const k of key) {
      x = x.get(k);
      if (x === undefined) return undefined;
    }

    return x as TValue;
  }

  set(...args: [...TKey, TValue]) {
    const restKeys = args.slice(0, -2) as object[];
    const lastKey = args[args.length - 2] as object;
    const value = args[args.length - 1];

    let x = this.map;

    for (const k of restKeys) {
      let nextMap = x.get(k);
      if (nextMap === undefined) {
        nextMap = new WeakMap();
        x.set(k, nextMap);
      }
      x = nextMap;
    }

    x.set(lastKey, value);
  }
}
