export function toCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function roundMoney(value: number): number {
  return fromCents(toCents(value));
}

export function sumMoney(values: number[]): number {
  return fromCents(values.reduce((total, value) => total + toCents(value), 0));
}
