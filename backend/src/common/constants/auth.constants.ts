/**
 * Auth-related constants. Use env overrides in runtime (e.g. ConfigService);
 * these are defaults only. No magic numbers in service code — import from here.
 */
export const MAX_FAILED_ATTEMPTS = 5;
export const DEFAULT_LOCKOUT_MINUTES = 15;
export const RESET_TOKEN_TTL_HOURS = 1;
/** TTL for temporary JWT issued when password is valid but MFA is required (e.g. '10m'). */
export const TEMP_JWT_TTL = '10m';
