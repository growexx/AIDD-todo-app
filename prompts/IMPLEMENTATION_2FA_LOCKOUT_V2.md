IMPLEMENTATION PROMPT: 2FA, 5-ATTEMPT LOCKOUT, AND BLOCK/RESET EMAIL (v2 — Production-Ready)
==============================================================================================

Purpose: Reusable implementation specification for adding two-factor authentication
to the login flow, account lockout after 5 failed attempts, and email on block with
password and MFA reset. Targets todo-app: NestJS + Next.js + MongoDB (Mongoose).

This prompt enforces production-ready standards aligned with the project's audit
report (audit.md, grade B, 82/100). All new code must meet or exceed the existing
quality bar and address relevant flagged issues.

═══════════════════════════════════════════════
1. CONTEXT AND SCOPE
═══════════════════════════════════════════════

- Integrate 2FA and lockout into the EXISTING login flow: email + password first,
  then TOTP when the user has MFA enabled.
- Target stack: NestJS, Mongoose, Next.js (App Router), Redux Toolkit, JWT (httpOnly cookie preferred).
- New capabilities not currently present:
  - Email sending via nodemailer (SMTP) or @sendgrid/mail — configured via env.
  - TOTP-based 2FA via speakeasy + qrcode (setup + verify).
  - Per-endpoint rate limiting on all new auth routes.
- Configurable via environment variables:
  - FRONTEND_URL — base URL for reset links (e.g. https://app.example.com).
  - LOCKOUT_DURATION_MINUTES — lockout window in minutes (default: 15).
  - MAX_FAILED_ATTEMPTS — attempts before lockout (default: 5).

AUDIT COMPLIANCE REQUIREMENTS (mandatory for all new code):
  - [A05] All new Mongoose queries must use validated DTOs + class-validator; no raw user
    input passed directly to queries. Document any express-mongo-sanitize workaround.
  - [A07] Apply @Throttle() on all new auth endpoints tighter than the global rate limit.
    Use a dedicated 'auth' throttler scope (e.g. 5 req / 60 s) rather than the global 10/60s.
  - [A04] No secrets or tokens written to logs. Log only non-sensitive metadata.
  - [A09] Log all auth failures at WARN level (email only, never password/token).
  - [A10] All async methods must throw NestJS HttpExceptions (BadRequestException,
    UnauthorizedException, ForbiddenException, NotFoundException); no raw Error.
  - Frontend: ALL errors (API, network, validation) must be surfaced via toast
    (e.g. react-hot-toast or the existing toast utility). Do NOT render inline error
    messages on components (no <p className="error">…</p> or similar). Every catch
    block must call toast.error(getApiErrorMessage(err)) using the shared helper.
  - [Code Quality] Extract and reuse getApiErrorMessage(err: unknown): string from
    the existing dashboard; do not duplicate the error-extraction block.
  - [API Design] New POST endpoints that create a resource must return 201 (use
    @HttpCode(HttpStatus.CREATED) + @ApiResponse({ status: 201 })).
  - [A02] All new endpoints must be documented with @ApiOperation and @ApiResponse
    (Swagger only active when NODE_ENV !== 'production').
  - [Maintainability] All exported service methods must have JSDoc. Use named constants
    (e.g. DEFAULT_LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS) — no magic numbers in source.
  - [Testing] Every new service method must have a corresponding unit test in *.spec.ts.
    Cover: happy path, lockout trigger, expired token, invalid TOTP.

═══════════════════════════════════════════════
2. DATA MODEL CHANGES (USER SCHEMA)
═══════════════════════════════════════════════

Extend the User Mongoose schema (user.schema.ts) with:

MFA fields:
- mfaEnabled: Boolean, default false.
- mfaSecret: String, optional; stored AES-256 encrypted (use crypto module + MFA_ENCRYPTION_KEY env var).
  Never returned in any API response (add select: false).
- mfaBackupCodes: [String], optional; each entry is bcrypt-hashed (saltRounds: 12);
  generated on MFA setup; single-use (remove entry after use).

Lockout fields:
- failedLoginAttempts: Number, default 0.
  Increment on each failed password attempt. Reset to 0 on successful login.
- lockedUntil: Date, optional.
  When set and lockedUntil > now, reject login. On 5th failure: set lockedUntil = now + LOCKOUT_DURATION_MINUTES.
  Clear on successful password reset or after lockout expiry.

Reset flow fields (all select: false):
- passwordResetToken: String, optional; SHA-256 hash of the issued token; single-use.
- passwordResetTokenExpiry: Date, optional; 1 hour from issue.
- mfaResetToken: String, optional; SHA-256 hash; single-use.
- mfaResetTokenExpiry: Date, optional; 1 hour from issue.

On unlock (after password reset or lockout expiry):
  Clear lockedUntil, reset failedLoginAttempts to 0.

Add compound indexes:
  UserSchema.index({ email: 1 })         — already exists; verify.
  UserSchema.index({ passwordResetToken: 1 }, { sparse: true })
  UserSchema.index({ mfaResetToken: 1 },      { sparse: true })

═══════════════════════════════════════════════
3. BACKEND — NEW MODULES AND FILES
═══════════════════════════════════════════════

3.1 CONSTANTS FILE
  File: backend/src/common/constants/auth.constants.ts
  Export:
    MAX_FAILED_ATTEMPTS (number, from env or default 5)
    DEFAULT_LOCKOUT_MINUTES (number, from env or default 15)
    RESET_TOKEN_TTL_HOURS (number, 1)
    TEMP_JWT_TTL (string, '10m')
  No magic numbers anywhere in service code; import from this file.

3.2 EMAIL SERVICE
  File: backend/src/email/email.service.ts
  - Injectable NestJS service; configured via EmailModule (register in AppModule).
  - Use nodemailer (SMTP) or @sendgrid/mail, selected by env var EMAIL_PROVIDER=smtp|sendgrid.
  - Method: sendAccountLockedEmail(to: string, resetUrl: string): Promise<void>
    JSDoc required. Subject: "Account locked – action required".
    Body: plain-text + HTML. Include reset link. Note expiry (1 hour).
    Log send success at INFO (no token in log — only recipient domain or masked email).
    On send failure: log at ERROR and rethrow as InternalServerErrorException.
  - SMTP env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
  - SendGrid env vars: SENDGRID_API_KEY, EMAIL_FROM.
  - Unit test: mock transporter; assert sendAccountLockedEmail calls send with correct subject.

3.3 UPDATED AUTH SERVICE
  File: backend/src/auth/auth.service.ts
  Add/update these methods (all must have JSDoc):

  login(dto: LoginDto): Promise<LoginResponseDto>
    - Look up user by email (include failedLoginAttempts, lockedUntil, mfaEnabled, mfaSecret
      with explicit .select('+failedLoginAttempts +lockedUntil +mfaEnabled +mfaSecret')).
    - If user not found: throw UnauthorizedException('Invalid email or password').
      WARN log: 'Login failed — user not found' with { email: dto.email }.
    - If user.lockedUntil && user.lockedUntil > new Date():
      throw ForbiddenException('Account locked. Check your email for reset instructions.').
      WARN log: 'Login attempt on locked account' { email: dto.email }.
    - If password invalid:
      Increment failedLoginAttempts (user.failedLoginAttempts += 1; save).
      WARN log: 'Failed login attempt' { email: dto.email, attempts: user.failedLoginAttempts }.
      If failedLoginAttempts >= MAX_FAILED_ATTEMPTS:
        Set lockedUntil = addMinutes(new Date(), DEFAULT_LOCKOUT_MINUTES).
        Generate resetToken = crypto.randomBytes(32).toString('hex').
        Set user.passwordResetToken = sha256(resetToken).
        Set user.passwordResetTokenExpiry = addHours(new Date(), RESET_TOKEN_TTL_HOURS).
        Set user.mfaResetToken = same token hash (one token covers both resets).
        Set user.mfaResetTokenExpiry = same expiry.
        Save user.
        Emit email (fire-and-forget; do NOT await — prevents timing oracle): 
          this.emailService.sendAccountLockedEmail(user.email, `${FRONTEND_URL}/reset-account?token=${resetToken}`).catch(err => this.logger.error('Email failed', err.message));
        throw ForbiddenException('Account locked. Check your email for reset instructions.').
      throw UnauthorizedException('Invalid email or password').
    - If password valid and mfaEnabled:
      Generate tempToken = this.jwtService.sign({ sub: user._id, mfa: true }, { expiresIn: TEMP_JWT_TTL }).
      Return { requiresMfa: true, tempToken }.
    - If password valid and !mfaEnabled:
      Reset failedLoginAttempts = 0; clear lockedUntil if set. Save.
      Issue full JWT. Return { token, user: { id, email, mfaEnabled } }.

  verifyMfa(dto: VerifyMfaDto): Promise<AuthResponseDto>
    - Validate and decode tempToken (must have mfa: true claim); throw UnauthorizedException if invalid.
    - Load user's mfaSecret (decrypted).
    - Verify TOTP code via speakeasy.totp.verify({ ... window: 1 }).
    - If invalid: throw UnauthorizedException('Invalid verification code').
    - Reset failedLoginAttempts = 0; clear lockedUntil. Save.
    - Issue full JWT. Return { token, user }.

  setupMfa(userId: string): Promise<MfaSetupResponseDto>
    - Generate new mfaSecret via speakeasy.generateSecret({ length: 20, name: APP_NAME }).
    - Do NOT set mfaEnabled yet.
    - Store encrypted secret temporarily (e.g. cache or return plainly for confirm step).
    - Generate qrcode data URI from secret.otpauth_url.
    - Return { secret: secret.base32, qrCodeDataUri, backupCodes: [] /* generated here */ }.
    - Generate 8 backup codes (crypto.randomBytes(5).toString('hex')); hash each with bcrypt.
    - Return plaintext codes once; store hashes in user.mfaBackupCodes. Save.

  confirmMfa(userId: string, dto: ConfirmMfaDto): Promise<void>
    - Verify submitted TOTP against stored (unconfirmed) secret.
    - If valid: set mfaEnabled = true; persist encrypted mfaSecret. Save.
    - If invalid: throw UnauthorizedException('Invalid verification code').

  resetPassword(dto: ResetPasswordDto): Promise<void>
    - Find user where sha256(dto.token) === passwordResetToken
      AND passwordResetTokenExpiry > now.
    - If not found: throw BadRequestException('Invalid or expired reset token').
    - Hash new password (bcrypt, saltRounds: 12). Update.
    - Clear passwordResetToken, passwordResetTokenExpiry, lockedUntil; set failedLoginAttempts = 0.
    - Save. Log INFO 'Password reset successful' { userId: user._id }.

  resetMfa(dto: ResetMfaDto): Promise<void>
    - Find user where sha256(dto.token) === mfaResetToken
      AND mfaResetTokenExpiry > now.
    - If not found: throw BadRequestException('Invalid or expired reset token').
    - Clear mfaEnabled = false, mfaSecret, mfaBackupCodes, mfaResetToken, mfaResetTokenExpiry.
    - Save. Log INFO 'MFA reset successful' { userId: user._id }.

3.4 AUTH CONTROLLER ADDITIONS
  File: backend/src/auth/auth.controller.ts

  All new routes must have:
    @ApiOperation + @ApiResponse (200/201/400/401/403)
    @UseGuards(ThrottlerGuard) with dedicated 'auth' scope (5 req / 60 s)
    Input DTOs validated by class-validator

  POST /auth/login              — existing; tighten to @Throttle({ auth: { limit: 5, ttl: 60000 } })
  POST /auth/verify-mfa         — @HttpCode(200); body: VerifyMfaDto { tempToken, code }
  POST /auth/mfa/setup          — requires JwtAuthGuard; @HttpCode(200)
  POST /auth/mfa/confirm        — requires JwtAuthGuard; @HttpCode(200); body: ConfirmMfaDto { code }
  POST /auth/reset-password     — @HttpCode(200); body: ResetPasswordDto { token, newPassword, confirmPassword }
  POST /auth/reset-mfa          — @HttpCode(200); body: ResetMfaDto { token }

  Note: POST /auth/mfa/setup and /auth/mfa/confirm do not create new top-level resources;
  200 is appropriate. POST /auth/reset-password and /auth/reset-mfa are actions, not resource
  creation; 200 is appropriate.

3.5 DTOs (all in backend/src/auth/dto/)
  LoginDto (existing) — add no changes.
  VerifyMfaDto: tempToken (@IsString @IsNotEmpty), code (@IsString @Length(6,8))
  ConfirmMfaDto: code (@IsString @Length(6,6))
  ResetPasswordDto: token (@IsString @IsNotEmpty), newPassword (@IsString @MinLength(8)),
    confirmPassword (@IsString) + custom validator that newPassword === confirmPassword.
  ResetMfaDto: token (@IsString @IsNotEmpty)

3.6 THROTTLER CONFIG
  File: backend/src/app.module.ts
  Configure ThrottlerModule with two named scopes:
    global: { ttl: 60_000, limit: 10 }   — existing behaviour preserved for non-auth routes
    auth:   { ttl: 60_000, limit: 5  }   — applied to all login/MFA/reset endpoints
  Apply @SkipThrottle() to health/root endpoints if desired.

3.7 SECURITY — NOSQL INJECTION
  All new service methods receive validated DTO objects only. Mongoose queries use:
    User.findOne({ email: dto.email })           — parameterized by Mongoose driver
    User.findOne({ passwordResetToken: hash })   — hash is a derived value, not raw input
  Document in a code comment above each query that raw user input is never interpolated.
  This satisfies the audit recommendation (A05) in the absence of express-mongo-sanitize.

═══════════════════════════════════════════════
4. EMAIL TEMPLATE
═══════════════════════════════════════════════

Subject: Your account has been locked – reset required

Plain-text body:
  Your account was locked after {{MAX_FAILED_ATTEMPTS}} failed login attempts.
  Click the link below to reset your password and (optionally) disable MFA.
  This link expires in 1 hour.

  {{FRONTEND_URL}}/reset-account?token={{resetToken}}

  If you did not attempt to log in, please contact support immediately.

HTML body: styled equivalent of the above; use inline CSS only (email client compatibility).

Token in URL: the raw (unhashed) token is placed in the URL. The server stores only the
SHA-256 hash. Never log the raw token.

═══════════════════════════════════════════════
5. FRONTEND — NEW PAGES AND CHANGES
═══════════════════════════════════════════════

GLOBAL RULE — ALL ERRORS VIA TOAST:
  Every catch block in every new and modified component must call:
    toast.error(getApiErrorMessage(err))
  NEVER render inline error messages on the component (no error state rendered in JSX).
  Import getApiErrorMessage from frontend/src/lib/errors.ts (create if absent).
  getApiErrorMessage must handle: AxiosError with response.data.message (string or string[]),
    network errors (no response), and unknown errors (fallback: 'Something went wrong').
  This aligns with dashboard.page.tsx audit fix [MEDIUM] and makes error UX consistent.

5.1 errors.ts helper (create or extend)
  File: frontend/src/lib/errors.ts
  Export:
    export function getApiErrorMessage(err: unknown): string {
      if (isAxiosError(err)) {
        const msg = err.response?.data?.message;
        if (Array.isArray(msg)) return msg[0];
        if (typeof msg === 'string') return msg;
        return err.message;
      }
      if (err instanceof Error) return err.message;
      return 'Something went wrong. Please try again.';
    }

5.2 UPDATED LOGIN PAGE
  File: frontend/src/app/login/page.tsx (or existing Login component)
  - Step 1: Submit email + password → POST /auth/login.
    On 200 with requiresMfa: true → store tempToken in React state (NOT localStorage);
      show TOTP input step in the same page (conditional render, not a new route).
    On 200 with token → dispatch setCredentials to authSlice; redirect to /dashboard.
    On 401 → toast.error(getApiErrorMessage(err))   ← NO inline "Invalid credentials" text
    On 403 → toast.error(getApiErrorMessage(err))   ← e.g. "Account locked. Check your email…"
    On network error → toast.error(getApiErrorMessage(err))
  - Step 2 (MFA input, conditional):
    Submit code + tempToken → POST /auth/verify-mfa.
    On 200 → dispatch setCredentials; redirect to /dashboard.
    On 401 → toast.error(getApiErrorMessage(err))
  - No error state in component; no <p> or <span> with error text rendered in JSX.
  - Show loading spinner (button disabled) during request.
  - tempToken must NOT be persisted in localStorage or sessionStorage; keep in useState only.
    (This partially mitigates [HIGH] token-in-localStorage audit finding for the temp token.)

5.3 RESET ACCOUNT PAGE
  File: frontend/src/app/reset-account/page.tsx
  - Read token from URL search params (useSearchParams).
  - Form fields: newPassword, confirmPassword + checkbox "Also disable MFA".
  - On submit:
    Always call POST /auth/reset-password { token, newPassword }.
    If "disable MFA" checked: also call POST /auth/reset-mfa { token } (sequentially; second
      call uses the SAME token — server allows it within the same session since one token
      covers both, or issue separate tokens as preferred; document the choice).
    On all success → toast.success('Password reset. You can log in now.'); redirect /login.
    On any error → toast.error(getApiErrorMessage(err))
  - No inline error messages.
  - If token is absent from URL on mount → toast.error('Invalid reset link.'); redirect /login.

5.4 MFA SETUP (Settings / Profile)
  File: frontend/src/app/settings/page.tsx or a dedicated MfaSetup component.
  - "Enable 2FA" button → POST /auth/mfa/setup.
    On success: display QR code (render <img src={qrCodeDataUri} />) and backup codes (one-time display).
    Show warning: "Save these backup codes. They will not be shown again."
    On error → toast.error(getApiErrorMessage(err))
  - Enter TOTP code → POST /auth/mfa/confirm.
    On success → toast.success('Two-factor authentication enabled.').
    On error → toast.error(getApiErrorMessage(err))
  - No inline error messages at any step.

5.5 REDUX AUTH SLICE
  File: frontend/src/store/slices/authSlice.ts
  - Add requiresMfa: boolean and tempToken: string | null to state if needed for the login flow.
    Clear tempToken immediately after successful verify-mfa response.
  - On logout or token expiry: clear requiresMfa and tempToken.

═══════════════════════════════════════════════
6. SECURITY AND PRODUCTION CONFIG
═══════════════════════════════════════════════

RATE LIMITING (audit A07):
  - All new auth endpoints use the tighter 'auth' throttler scope (5 req / 60 s).
  - Health and other non-auth endpoints retain global scope or @SkipThrottle().

TOKEN STORAGE (audit HIGH — token in localStorage):
  - New full JWT should be set as an httpOnly, Secure, SameSite=Strict cookie by the server
    rather than returned in the body for client-side storage in localStorage.
  - If cookie-based auth is implemented: remove localStorage token write in auth.ts.
  - If localStorage must be kept (e.g. existing app constraint): document the risk explicitly
    in a code comment and in the README security section, and harden CSP.
  - The tempToken (MFA intermediate) must NEVER be written to localStorage; use useState only.

TOKENS IN EMAILS (audit A04):
  - Store only SHA-256(token) in DB. Raw token in URL only.
  - Never log raw token. Log only { userId, tokenExpiry } at INFO.

MONGO SANITIZE (audit A05):
  - New code: all queries use DTO-validated inputs or derived values (hashes).
    Add a comment: // Input is DTO-validated; raw user string not interpolated into query.
  - Document in README/CONTRIBUTING that express-mongo-sanitize is pending a compatible
    solution for Express 5; mitigated by DTOs + whitelist validation.

ENVIRONMENT VARIABLES (add to .env.example and root README):
  # 2FA / Lockout
  FRONTEND_URL=http://localhost:3000
  LOCKOUT_DURATION_MINUTES=15
  MAX_FAILED_ATTEMPTS=5
  MFA_ENCRYPTION_KEY=<32-byte hex>

  # Email
  EMAIL_PROVIDER=smtp          # smtp | sendgrid
  SMTP_HOST=
  SMTP_PORT=587
  SMTP_USER=
  SMTP_PASS=
  SMTP_FROM=noreply@example.com
  SENDGRID_API_KEY=
  EMAIL_FROM=noreply@example.com

HTTPS: Reset links and cookie flags must use HTTPS in production (Secure cookie flag; HTTPS in FRONTEND_URL).

═══════════════════════════════════════════════
7. TESTING REQUIREMENTS
═══════════════════════════════════════════════

Backend unit tests (*.spec.ts):
  auth.service.spec.ts — add/extend:
    - login: success without MFA → returns token
    - login: success with MFA → returns requiresMfa: true + tempToken
    - login: invalid password → increments failedLoginAttempts; returns 401
    - login: 5th failure → sets lockedUntil; sends email; returns 403
    - login: locked account → returns 403 without touching failedLoginAttempts
    - verifyMfa: valid code → returns token; resets failedLoginAttempts
    - verifyMfa: invalid code → throws 401
    - resetPassword: valid token → clears lockout; updates password
    - resetPassword: expired token → throws 400
    - resetMfa: valid token → clears MFA fields
    - resetMfa: used/invalid token → throws 400

  email.service.spec.ts:
    - sendAccountLockedEmail: assert transporter.sendMail called with correct to/subject
    - sendAccountLockedEmail: transport failure → throws InternalServerErrorException

Frontend:
  - login.test.tsx: on 401 response → toast.error called; no inline error in DOM
  - login.test.tsx: on 200 requiresMfa → MFA input shown; tempToken in state not localStorage
  - reset-account.test.tsx: on success → toast.success called; redirects to /login
  - getApiErrorMessage.test.ts: covers AxiosError (string msg), AxiosError (array msg),
      network error, unknown error

═══════════════════════════════════════════════
8. FILE CHECKLIST
═══════════════════════════════════════════════

Backend (new / modified):
  [ ] backend/src/common/constants/auth.constants.ts         (NEW)
  [ ] backend/src/email/email.module.ts                      (NEW)
  [ ] backend/src/email/email.service.ts                     (NEW)
  [ ] backend/src/email/email.service.spec.ts                (NEW)
  [ ] backend/src/auth/auth.service.ts                       (MODIFIED)
  [ ] backend/src/auth/auth.service.spec.ts                  (MODIFIED)
  [ ] backend/src/auth/auth.controller.ts                    (MODIFIED)
  [ ] backend/src/auth/dto/verify-mfa.dto.ts                 (NEW)
  [ ] backend/src/auth/dto/confirm-mfa.dto.ts                (NEW)
  [ ] backend/src/auth/dto/reset-password.dto.ts             (NEW)
  [ ] backend/src/auth/dto/reset-mfa.dto.ts                  (NEW)
  [ ] backend/src/users/user.schema.ts                       (MODIFIED)
  [ ] backend/src/app.module.ts                              (MODIFIED — throttler scopes)
  [ ] backend/.env.example                                   (MODIFIED — new vars)

Frontend (new / modified):
  [ ] frontend/src/lib/errors.ts                             (NEW or MODIFIED)
  [ ] frontend/src/app/login/page.tsx                        (MODIFIED)
  [ ] frontend/src/app/reset-account/page.tsx                (NEW)
  [ ] frontend/src/app/settings/page.tsx                     (MODIFIED — MFA setup section)
  [ ] frontend/src/store/slices/authSlice.ts                 (MODIFIED)
  [ ] frontend/src/app/login/login.test.tsx                  (NEW or MODIFIED)
  [ ] frontend/src/app/reset-account/reset-account.test.tsx  (NEW)
  [ ] frontend/src/lib/errors.test.ts                        (NEW)

Docs:
  [ ] README.md — add: new env vars, MFA setup instructions, security notes
  [ ] README.md — document express-mongo-sanitize status (A05 mitigation note)
  [ ] CONTRIBUTING.md — update: no magic numbers; use auth.constants.ts; toast-only errors

═══════════════════════════════════════════════
9. PLACEHOLDERS
═══════════════════════════════════════════════

Replace at integration time:
  {{FRONTEND_URL}}              — e.g. https://app.example.com
  {{LOCKOUT_DURATION_MINUTES}}  — e.g. 15
  {{MAX_FAILED_ATTEMPTS}}       — e.g. 5
  {{APP_NAME}}                  — used in TOTP QR code issuer label

═══════════════════════════════════════════════
END OF SPECIFICATION v2
═══════════════════════════════════════════════
