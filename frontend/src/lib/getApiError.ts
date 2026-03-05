/**
 * Shared API error helper for consistent 403/401/generic messages in RBAC admin and other API catch blocks.
 * Use in catch blocks so all pages show the same user-facing messages (audit code quality 9–10).
 */

export interface ApiErrorResult {
  message: string;
  status?: number;
}

/**
 * Extract a user-facing message and optional status from an API error (e.g. axios error).
 * Returns: 403 → "Permission denied", 401 → "Please log in", else → message from response or generic.
 */
export function getApiErrorMessage(err: unknown): string {
  const result = getApiError(err);
  return result.message;
}

/**
 * Extract both message and status from an API error.
 */
export function getApiError(err: unknown): ApiErrorResult {
  const ax = err as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
  const status = ax?.response?.status;
  const msg =
    ax?.response?.data?.error?.message ??
    ax?.message ??
    'Something went wrong';

  if (status === 403) return { message: 'Permission denied', status: 403 };
  if (status === 401) return { message: 'Please log in', status: 401 };
  return { message: typeof msg === 'string' ? msg : 'Something went wrong', status };
}
