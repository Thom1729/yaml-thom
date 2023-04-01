export function parseDecimal(s: string) {
  const result = parseInt(s, 10);
  if (isNaN(result)) {
    throw new TypeError(`Can't parse ${JSON.stringify(s)} as decimal integer`);
  } else {
    return result;
  }
}


export function parseHex(s: string) {
  const result = parseInt(s, 16);
  if (isNaN(result)) {
    throw new TypeError(`Can't parse ${JSON.stringify(s)} as hex integer`);
  } else {
    return result;
  }
}
