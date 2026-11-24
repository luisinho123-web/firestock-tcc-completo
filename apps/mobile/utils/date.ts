export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

/** "agora" / "21 min" / "2h" for today, "ontem" for yesterday, otherwise a short date — used by the
 * notifications list where each row needs a compact relative timestamp. */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'agora';
  if (diffMinutes < 60) return `${diffMinutes} min`;

  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return `${Math.floor(diffMinutes / 60)}h`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'ontem';

  return formatShortDate(date);
}
