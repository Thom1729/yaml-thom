export function groupBy<T, R>(
  values: Iterable<T>,
  keySelector: (value: T) => R,
) {
  const ret = new Map<R, [T, ...T[]]>();

  for (const value of values) {
    const key = keySelector(value);
    const existingGroup = ret.get(key);

    if (existingGroup) {
      existingGroup.push(value);
    } else {
      ret.set(key, [value]);
    }
  }

  return ret;
}
