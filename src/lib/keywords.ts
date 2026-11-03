export function keywords(...parts: Array<string | null | undefined>): string[] {
  const values = new Set<string>();
  for (const part of parts) {
    const normalized = part?.toLowerCase().trim();
    if (!normalized) continue;
    values.add(normalized);
    for (const word of normalized.split(/[^\p{L}\p{N}]+/u)) {
      if (word.length >= 2) values.add(word);
    }
  }
  return [...values].slice(0, 40);
}
