/**
 * Formats a timestamp into a human-friendly readable format.
 * Examples:
 * - Just now
 * - 2 mins ago / 1 min ago
 * - Today, 09:15 UTC
 * - Jun 25, 2026 • 09:15 UTC
 * - Fallback: "Timestamp unavailable"
 */
export function formatFriendlyTimestamp(dateInput: string | Date | number | undefined | null): string {
  if (!dateInput) {
    return 'Timestamp unavailable';
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return 'Timestamp unavailable';
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  // "Just now" - within 1 minute
  if (diffMs >= 0 && diffMs < 60000) {
    return 'Just now';
  }

  // "X mins ago" - within 1 hour
  if (diffMs >= 0 && diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;

  // "Today, hh:mm UTC"
  const isToday = d.getUTCFullYear() === now.getUTCFullYear() &&
                  d.getUTCMonth() === now.getUTCMonth() &&
                  d.getUTCDate() === now.getUTCDate();
  if (isToday) {
    return `Today, ${timeStr}`;
  }

  // "Jun 25, 2026 • 09:15 UTC"
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();

  return `${monthStr} ${day}, ${year} • ${timeStr}`;
}
