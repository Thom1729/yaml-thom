export function parseHex(s: string) {
  const result = parseInt(s, 16);
  if (isNaN(result)) {
    throw new TypeError(`Can't parse ${JSON.stringify(s)} as hex`);
  } else {
    return result;
  }
}
