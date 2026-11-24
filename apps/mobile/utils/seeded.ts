/** Stable 0–1 value derived from a string, so mock data (courier names, comparison prices) stays the
 * same for a given order/product instead of reshuffling on every render. */
export function seededFraction(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return hash / 100000;
}

export function seededPick<T>(seed: string, options: readonly T[]): T {
  return options[Math.floor(seededFraction(seed) * options.length)];
}
