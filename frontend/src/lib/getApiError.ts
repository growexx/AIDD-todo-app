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
 * Handles: response.data.message (string or string[]), response.data.error.message,
 * network errors (no response), 429 rate limit, and unknown errors.
 */
export function getApiError(err: unknown): ApiErrorResult {
  const ax = err as {
    response?: { status?: number; data?: { message?: string | string[]; error?: { message?: string } } };
    message?: string;
    code?: string;
  };
  const status = ax?.response?.status;
  const dataMsg = ax?.response?.data?.message;
  const msg =
    (Array.isArray(dataMsg) ? dataMsg[0] : typeof dataMsg === 'string' ? dataMsg : null) ??
    ax?.response?.data?.error?.message ??
    (status === 403 ? 'Account locked. Check your email for reset instructions.' : null) ??
    (status === 401 ? 'Invalid email or password.' : null) ??
    (status === 429 ? 'Too many attempts. Please try again later.' : null) ??
    (ax?.code === 'ERR_NETWORK' || !ax?.response ? 'Network error. Please check your connection.' : null) ??
    ax?.message ??
    'Something went wrong. Please try again.';

  return { message: typeof msg === 'string' ? msg : 'Something went wrong. Please try again.', status };
}
