// Date Utilities - Shared functions for date/time operations

/**
 * Get a Date object for a time in the future.
 *
 * @param minutes - Minutes from now
 * @returns Date object for the future time
 */
export function getFutureDate(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Get an ISO date string for a time in the future.
 *
 * @param minutes - Minutes from now
 * @returns ISO date string (e.g., "2024-01-15T14:30:00.000Z")
 */
export function getISODateFromNow(minutes: number): string {
  return getFutureDate(minutes).toISOString();
}

/**
 * Get the current time as an ISO date string.
 *
 * @returns Current time as ISO string
 */
export function getNowISO(): string {
  return new Date().toISOString();
}

/**
 * Check if a timestamp has expired.
 *
 * @param timestamp - The timestamp to check (milliseconds since epoch)
 * @param minutes - Expiration time in minutes
 * @returns true if the timestamp is older than the specified minutes
 */
export function isExpired(timestamp: number, minutes: number): boolean {
  const expirationMs = minutes * 60 * 1000;
  return Date.now() - timestamp > expirationMs;
}

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago").
 *
 * @param timestamp - Timestamp in milliseconds
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Generate a timestamp string for filenames.
 * Format: "YYYYMMDDTHHMMSS" (e.g., "20240115T143022")
 *
 * @returns Timestamp string without special characters
 */
export function getFilenameTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
}
