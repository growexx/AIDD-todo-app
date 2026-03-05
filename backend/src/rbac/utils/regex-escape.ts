/**
 * Escape special regex characters in a string before using it in MongoDB $regex.
 * Prevents ReDoS and regex injection (audit A05).
 */
export function escapeForRegex(value: string | null | undefined): string {
  if (value == null || typeof value !== 'string') return '';
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
