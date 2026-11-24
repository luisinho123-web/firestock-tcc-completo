/** Up to two uppercase initials ("Flávio Silva" → "FS"), used by avatar placeholders. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** `pluralize(1, 'item', 'itens')` → "1 item"; `pluralize(3, 'item', 'itens')` → "3 itens". */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "20 min" or "30–40 min". */
export function formatMinutesRange(min: number, max: number): string {
  return min === max ? `${min} min` : `${min}–${max} min`;
}

/** Accent- and case-insensitive key for search matching: "maca" finds "Maçã gala". */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
