import { HttpException, HttpStatus } from '@nestjs/common';

export const RBAC_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PERMISSION_FORMAT: 'INVALID_PERMISSION_FORMAT',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export interface RbacErrorDetails {
  requiredPermission?: string;
  [key: string]: unknown;
}

/**
 * RBAC exception with code and optional details for consistent error envelope.
 */
export class RbacException extends HttpException {
  constructor(
    statusCode: HttpStatus,
    code: string,
    message: string,
    details?: RbacErrorDetails | null,
  ) {
    super(
      { error: { code, message, ...(details ? { details } : {}) } },
      statusCode,
    );
  }

  getCode(): string {
    const res = this.getResponse() as { error?: { code?: string } };
    return res?.error?.code ?? 'INTERNAL_ERROR';
  }

  getDetails(): RbacErrorDetails | undefined {
    const res = this.getResponse() as { error?: { details?: RbacErrorDetails } };
    return res?.error?.details;
  }
}
