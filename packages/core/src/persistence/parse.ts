export function parseUnsignedInteger(value: string, label: string): bigint {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new TypeError(`Invalid ${label}`);
  return BigInt(value);
}
