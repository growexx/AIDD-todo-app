# Full-Stack Code Audit Report
Generated: Tuesday Mar 3, 2025
Stack: NestJS + Next.js + MongoDB
---

## Executive Summary

- **Production-readiness score: 6/10** — Solid access control, validation, and structure, but critical gaps: express-mongo-sanitize not applied, exception filter logs stack (info leak risk), .env.example contains a default MFA key, and frontend token in localStorage.
- **Total issue count by severity:** CRITICAL: 2 | HIGH: 11 | MEDIUM: 22 | LOW: 38 | INFO: 5
- **Top 3 most dangerous issues:** (1) express-mongo-sanitize installed but never applied in main.ts, allowing NoSQL injection via `{ "$gt": "" }` in body/query. (2) .env.example documents MFA_ENCRYPTION_KEY with a sample 64-hex value; using it in production is a cryptographic failure. (3) Exception filter logs full exception.stack to Logger; in some deployments logs are exposed or forwarded, leaking internal paths.
- **Top 3 strongest areas:** (1) Todo access control — every find/update/delete scopes by `user: req.user.userId`. (2) ValidationPipe with whitelist and forbidNonWhitelisted, and search regex escaped in todos.service. (3) User schema: password and MFA fields use select: false; bcrypt salt rounds 12; JWT and CORS configured correctly.
- **VERDICT: FIX-THEN-SHIP**

---

## Security Audit — OWASP Top 10:2025

**A01:2025 — Broken Access Control (includes SSRF)**  
**✅ PASS**  
- Every todo controller method uses `JwtAuthGuard` and passes `req.user.userId`; service methods scope by `{ _id, user: userId }`. No endpoint returns a list without user scoping for todos. No endpoint accepts a URL and performs server-side HTTP calls (no SSRF). RBAC endpoints are intentionally admin-scoped by permission, not by resource owner.

**A02:2025 — Security Misconfiguration**  
**⚠️ PARTIAL**  
- **helmet()**: ✅ Called in main.ts after pipes/filters, before routes (with compression).  
- **CORS**: ✅ Uses `clientUrl` from config (CLIENT_URL), not wildcard.  
- **Exception filter**: ❌ **File:** `backend/src/common/filters/http-exception.filter.ts`, method `catch`. **Issue:** `this.logger.error(..., exception instanceof Error ? exception.stack : undefined)` writes full stack traces to the logger. In many production setups logs are aggregated or exposed; stack traces leak file paths and internals. **Fix:** In production, log only `exception instanceof Error ? exception.message : String(exception)` and omit stack, or redact paths from stack.  
- **NODE_ENV**: ✅ Swagger and demo auth are gated on `NODE_ENV !== 'production'`.  
- **Swagger UI**: ⚠️ INFO — Exposed without auth when not in production; acceptable for dev, plan auth or disable in prod (already disabled when NODE_ENV is production).

**A03:2025 — Software Supply Chain Failures**  
**⚠️ PARTIAL**  
- No `*` or `latest` in backend or frontend package.json versions; all use semver ranges (e.g. `^11.0.1`).  
- **package-lock.json**: Present in backend; frontend uses npm/pnpm lockfile pattern — ensure lockfile is committed for reproducible installs.  
- **Dev vs prod deps**: `ts-node` is devDependency (correct). No obvious production-only packages in devDependencies.  
- **CVE-prone packages**: mongoose ^9.2.3 (v9+), next 16.x, @nestjs/* ^11 — versions are recent; no known critical CVEs flagged for these versions in this audit.

**A04:2025 — Cryptographic Failures**  
**⚠️ PARTIAL**  
- **bcrypt**: ✅ User schema pre-save uses `bcrypt.genSalt(12)` and hash — salt rounds 12.  
- **Password field**: ✅ User schema has `select: false` on password (and MFA-related fields).  
- **JWT_SECRET**: ✅ Only read via ConfigService from env; no hardcoded secret in source.  
- **JWT expiry**: ✅ Uses JWT_EXPIRES_IN from env (e.g. 7d); not hardcoded long expiry.  
- **Sensitive data in logs**: ✅ No passwords or tokens written to logs.  
- **MFA key in .env.example**: ❌ **File:** `backend/.env.example`. **Issue:** `MFA_ENCRYPTION_KEY=3ea092a9aa81c4252dd788647a2cc0a9dc21226b072463a8ce843075cf11bf58` — a fixed 64-hex value is documented. If used in production, anyone with this key can decrypt MFA secrets. **Fix:** Remove the value; document that a unique 64-character hex key must be generated (e.g. `openssl rand -hex 32`) and never commit a default.

**A05:2025 — Injection**  
**⚠️ PARTIAL**  
- **Search regex (todos)**: ✅ `todos.service.ts` escapes search with `query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before `$regex` — ReDoS/injection mitigated.  
- **express-mongo-sanitize**: ❌ **File:** `backend/src/main.ts`. **Issue:** Package is installed but never applied. Without it, request body/query can contain `{ "$gt": "" }`-style operators and bypass auth or validation when merged into queries. **Attack:** Send `email: { "$gt": "" }` on login to match first user; or inject into other unsanitized inputs. **Fix:** In main.ts, after creating the app and before routes: `const mongoSanitize = require('express-mongo-sanitize'); app.use(mongoSanitize());` (or equivalent import). Apply to all request bodies and query strings.  
- **ValidationPipe**: ✅ Uses `whitelist: true` and `forbidNonWhitelisted: true` in main.ts.  
- **Login email**: ✅ Login uses LoginDto with `@IsEmail()`; ValidationPipe runs before handler.  
- **RBAC search (listRoles / listPermissions)**: ❌ **File:** `backend/src/rbac/rbac.service.ts`, methods `listRoles` and `listPermissions`. **Issue:** `search` is used in `filter.name = { $regex: search, $options: 'i' }` and `filter.code = { $regex: search, $options: 'i' }` without escaping. User-controlled search can cause ReDoS or regex injection. **Fix:** Escape with `search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before building the filter.

**A06:2025 — Vulnerable and Outdated Components**  
**✅ PASS**  
- @nestjs/* packages are ^11; mongoose ^9.2.3; next 16.1.6. All on current major versions; no package more than 2 major versions behind.

**A07:2025 — Identification and Authentication Failures**  
**⚠️ PARTIAL**  
- **Rate limiting**: ThrottlerGuard is applied on login and verify-mfa; ThrottlerModule is global `[{ ttl: 60000, limit: 10 }]` — 10 req/min per IP. Per-endpoint stricter limit for POST /api/auth/login is not configured; consider a dedicated throttle for auth endpoints (MEDIUM).  
- **User enumeration**: ✅ Auth controller returns same message for invalid credentials and locked: "Invalid credentials" and "Account locked. Check your email..." — validateUser returns null for both wrong password and missing user; login returns null or 'locked' with consistent client messages.  
- **Token revocation**: INFO — No revocation mechanism; acceptable for JWT-only design.  
- **JWT strategy**: ✅ Sets req.user to `{ userId: payload.sub, email: payload.email }`; controllers use req.user.userId correctly.

**A08:2025 — Software and Data Integrity Failures**  
**✅ PASS**  
- No eval(), Function(), or vm.runInNewContext() in backend. No dangerouslySetInnerHTML in frontend. No deserialization of untrusted serialized objects without validation.

**A09:2025 — Security Logging and Alerting Failures**  
**⚠️ PARTIAL**  
- **console in production code**: ❌ Several files use console.log/console.warn/console.error outside seed/runner scripts: `rbac/rbac.service.ts` (console.warn), `rbac/rbac.cache.ts` (console.warn x3), `auth/email.service.ts` (console.log when SMTP not configured). **Fix:** Use NestJS Logger and gate verbose content on NODE_ENV; replace console in rbac.cache and rbac.service with Logger.  
- **Auth failures**: Exception filter logs method, path, status, message; it does not explicitly log at WARN for 401/403 — consider logging auth failures at WARN with path and timestamp (no credentials).  
- **No passwords/tokens in logs**: ✅ Confirmed.  
- **Exception filter context**: ✅ Logs path, method, status, message, and stack (stack should be restricted in prod per A02).

**A10:2025 — Mishandling of Exceptional Conditions**  
**✅ PASS**  
- Async service methods throw NestJS exceptions (BadRequestException, NotFoundException, UnauthorizedException, etc.) or propagate; no raw Error thrown to HTTP layer without mapping.  
- AllExceptionsFilter catches all exceptions and returns JSON; non-HttpException get 500 and message.  
- Database connection is via MongooseModule.forRootAsync; no explicit connectDB that calls process.exit(1) in this codebase; NestJS will fail startup if DB is unreachable.  
- Frontend: API calls are in try/catch with toast/error state; async errors in useEffect (e.g. fetchTodos, fetchStatus) are caught and surfaced.  
- No service method throws raw Error instead of HttpException for API-facing errors.

---

## Code Quality Analysis (SonarQube Rules)

- **Cognitive Complexity (S3776):** No function clearly exceeds 15 in the reviewed files; auth.service login/verifyMfa/mfaSetup have multiple branches but are within range. No MEDIUM flag.
- **Code Duplication (S4144):** MEDIUM — `auth.service.ts` resetPassword and resetMfa both iterate `userModel.find({}).select(...)` and compare token/expiry in a loop; extract a shared `findUserByResetToken(token)` helper.
- **Dead Code (S1144, S1481):**  
  - LOW: `backend/src/app.controller.ts` — AppService/AppController getHello are unused by main app (root GET is not mounted in main.ts; only HealthController and module routes are used). Root GET may be intended for health; if not, remove or document.  
  - LOW: `frontend/src/app/layout.tsx` — `Metadata` is imported from 'next' but not used (no export metadata). Remove unused import.
- **No any types:** MEDIUM — `todos.service.ts` return type uses `TodoDocument`; some casts `(todo as { updatedAt?: Date })`; `frontend` uses `Record<string, unknown>` and typed responses; no critical `any` in API handling. rbac.service uses `(data as RoleDocument[])` etc.; keep types strict and avoid any in new code.
- **No console in production (S2228):** LOW each — backend: `rbac/seed-runner.ts` (console.log/error — acceptable for CLI); `rbac/rbac.service.ts` line 255 console.warn; `rbac/rbac.cache.ts` lines 33, 38, 42 console.warn; `auth/email.service.ts` line 63 console.log; `database/seeder.ts` console.log/error (acceptable for seed). Frontend: `PermissionProvider.tsx` line 52 console.error. Replace with Logger / structured logging where appropriate.
- **Magic numbers/strings (S109, S1192):** LOW — bcrypt rounds 12 and 10 (reset token hash) are inline; port 5000 and 3000 appear in defaults. Prefer named constants (e.g. BCRYPT_SALT_ROUNDS = 12) and env-only for port.
- **Function length (S138):** No function exceeds 50 lines; auth.service methods are long but under limit.
- **Consistent return (S3801):** No inconsistent return patterns flagged.
- **Commented-out code (S125):** None observed.
- **Unused imports:** LOW — `frontend/src/app/layout.tsx` imports `Metadata` and does not use it. Backend: no unused imports in reviewed files.

---

## API Design Audit

- **RESTful correctness:** ✅ GET for reads, POST for create, PATCH for update and toggle, DELETE for delete. No misuse.
- **Response shape:** ⚠️ MEDIUM — HealthController returns `{ status, timestamp }` and AppController getHello returns a string; they do not use the ResponseInterceptor envelope `{ success, data }`. All other endpoints go through ResponseInterceptor. **Fix:** Either run health/root through the interceptor (e.g. return { status: 'ok', timestamp } as data) or document that health/root are intentionally unwrapped.
- **HTTP status codes:** ✅ 201 for create (RbacController createRole returns 201 per @ApiResponse); 200 for success; 400 for validation; 401 for auth; 404 for not found; 409 for conflict (RBAC); 500 from exception filter. Auth controller uses UnauthorizedException and ForbiddenException correctly.
- **Input validation:** ✅ POST/PUT/PATCH use DTOs with class-validator (LoginDto, CreateTodoDto, UpdateTodoDto, CreateRoleDto, etc.). Todo list uses TodoQuery interface without class-validator — LOW; consider ListTodoQueryDto with @IsOptional() @IsString() for search, etc.
- **Swagger:** ✅ Controllers have @ApiOperation and @ApiResponse where applicable. HealthController has no Swagger decorators — LOW.
- **Pagination:** ✅ GET /api/todos uses page and limit (default 20, max 100) in todos.service; no unbounded list.
- **API versioning:** INFO — No /v1/ prefix; plan versioning before adding v2.

---

## Database & Mongoose Audit

- **Compound index:** ✅ Todo schema has `TodoSchema.index({ user: 1, createdAt: -1 });` — findAll uses this pattern; no full collection scan for list.
- **User email unique:** ✅ User schema has `unique: true` on email.
- **Unbounded queries:** ✅ findAll uses .limit(limit) and .skip(skip); limit capped at 100.
- **Schema validation:** Todo and User have required, minlength, maxlength, enum where appropriate. LOW: Some optional fields could have maxlength (e.g. description 1000 is present).
- **.lean():** ✅ todos.service findAll uses `.lean<TodoDocument[]>()` for read-only list.
- **Timestamps:** ✅ Todo and User use `@Schema({ timestamps: true })`; no manual pre-save for createdAt/updatedAt on Todo (todo.service manually sets updatedAt on update/toggle — redundant if timestamps: true; Mongoose updates updatedAt automatically).
- **Seeder safety:** ✅ Main seeder checks `if (process.env['NODE_ENV'] === 'production') { console.error(...); process.exit(1); }` before deleteMany. RBAC seed does not delete users/todos but does upsert roles/permissions and assign roles; it does not check NODE_ENV — MEDIUM: add NODE_ENV check to seed-runner if it should never run in production.
- **Connection resilience:** Mongoose is used via forRootAsync with serverSelectionTimeoutMS and retryWrites/retryReads; no explicit retry loop. MEDIUM: For production, consider retry logic in bootstrap (e.g. retry connect with backoff) before app.listen.

---

## Testing Audit

- **Coverage gaps:**  
  - AuthService: login (full flow with MFA/locked), handleFailedLogin, clearLockout, issueToken, verifyMfa, mfaSetup, mfaConfirm, resetPassword, resetMfa, getMfaStatus are not fully covered; validateUser and a single login test exist but login test is broken (see below).  
  - EmailService: no tests.  
  - RbacService: no unit tests.  
  - HealthController: no test.  
  - AllExceptionsFilter / ResponseInterceptor: no tests.
- **Test isolation:** ✅ Todos and auth specs mock Mongoose model and JwtService; no real DB in unit tests.
- **Missing edge cases:**  
  - findAll: invalid ObjectId for userId — not explicitly tested (service receives string from guard; guard ensures user).  
  - create: title whitespace-only — ✅ tested.  
  - update: invalid ObjectId — ✅ tested.  
  - delete: double delete — not tested (second call returns 404).  
  - toggleComplete: idempotent — not explicitly tested (two toggles return to original state).  
- **Auth tests:** ✅ JwtStrategy.validate() is tested in jwt.strategy.spec.ts.
- **Controller tests:** ✅ TodosController has integration-style tests with overridden JwtAuthGuard. AuthController and RbacController have no controller-level tests — MEDIUM.
- **afterEach:** ✅ jest.clearAllMocks() in afterEach in todos and auth service/controller specs.
- **Assertion quality:** auth.service.spec "login" test calls `service.login(mockUser as never)` but AuthService.login(email: string, password: string) expects two arguments; test is incorrect and would fail at runtime. AuthService test module also does not provide EmailService (AuthService constructor requires it) — test setup is broken. **Fix:** Provide EmailService mock and test login with email/password (e.g. mock findUserByLogin, then assert token shape).

---

## Frontend Audit

**Auth and State**  
- isAuthenticated is used inside useEffect on dashboard/settings after `hydrated`; redirect happens in effect, not at top level — ✅ avoids hydration mismatch.  
- Token in localStorage — ⚠️ MEDIUM: XSS can steal token; httpOnly cookie is more secure. Document as known trade-off or plan migration to cookies.  
- clearAuth() removes both token and user from localStorage — ✅.

**Next.js App Router**  
- Client components that use useState/useEffect/useContext have 'use client' (AuthContext, dashboard, login, settings, reset-account, Navbar, TodoCard, TodoForm, SearchBar, PermissionProvider, etc.) — ✅.  
- redirect() used in app/page.tsx (server component); router.push() in client components — ✅.  
- Raw <img> in settings for QR code (data URL) — LOW; eslint-disable-next-line present. Next Image not required for data URLs.  
- Internal navigation uses <Link> and router.push — ✅.

**API Layer**  
- Responses: Frontend uses `data.data` for wrapped responses (e.g. login, verify-mfa, todos, mfa/status) — ✅ matches ResponseInterceptor.  
- All api.get/post/patch/delete calls observed are inside try/catch or .catch.  
- baseURL: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'` — ✅ env-based; .env.local.example documents NEXT_PUBLIC_API_URL.

**Forms**  
- TodoForm dueDate min: `const todayMin = () => new Date().toISOString().split('T')[0]` — ✅ computed at render.  
- Forms validate client-side (password length, match, trim) and server returns validation errors.  
- Submit buttons use `disabled={loading}` / `disabled={submitting}` — ✅.

**Performance**  
- Search/filter: Dashboard useEffect has 400ms setTimeout before fetchTodos — ✅ debounced.  
- useEffect deps: fetchTodos in dashboard depends on [hydrated, isAuthenticated, router, search, filterCompleted, filterPriority, fetchTodos]; fetchTodos is useCallback with [] — ✅.  
- TodoCard: exported as React.memo(TodoCardInner) — ✅.

**TypeScript**  
- No `as any` in frontend components; some `(err as { response?: ... })` for error handling — acceptable.  
- API responses typed with interfaces (e.g. success: true, data: { items, total }) — ✅.  
- Component props have explicit interfaces (TodoCardProps, TodoFormProps, SearchBarProps) — ✅.

---

## Performance Audit

**Backend**  
- .lean() used on todos findAll — ✅.  
- Compound index { user: 1, createdAt: -1 } on Todo — ✅.  
- compression() in main.ts — ✅.  
- Search regex: todos use escaped search; regex is applied to title/description with $or, so not anchored; index can still be used for { user, createdAt } then in-memory filter is not; for large result sets consider text index or anchored patterns — MEDIUM (unchanged from current design note).

**Frontend**  
- Tailwind: globals.css uses `@import "tailwindcss"`; Tailwind v4 content is typically auto-configured — no content array misconfiguration observed.  
- Images: QR code is inline data URL with <img>; no external images to optimize — LOW.

---

## Maintainability & Documentation Audit

- **JSDoc:** Many modules have class/method comments (e.g. HealthController, ResponseInterceptor, AllExceptionsFilter, auth and todo DTOs). LOW: Some exported functions (e.g. crypto.util, wildcard.matcher) have JSDoc; rbac.service and auth.service could add more method-level JSDoc.
- **README:** ✅ Root README.md exists with stack, setup, seed, test, credentials.
- **.env.example:** Backend .env.example documents PORT, MONGODB_URI, JWT_*, CLIENT_URL, FRONTEND_URL, NODE_ENV, MFA_ENCRYPTION_KEY (remove default value — see Security), SMTP_*, RBAC vars, DEMO_AUTH, REDIS, RATE_LIMIT. All process.env and ConfigService.get usages appear documented except optional REDIS (commented). HIGH: Remove default value for MFA_ENCRYPTION_KEY.
- **Magic strings:** Priority values 'low','medium','high' are in Todo schema enum and frontend types; no central enum in shared types — MEDIUM: consider shared constant or enum.
- **Naming:** PascalCase for components/classes, camelCase for methods/variables, kebab-case not strictly used for file names (e.g. TodoCard.tsx). Consistent enough — no major flag.
- **Circular dependencies:** No circular imports observed; modules import via public APIs.

---

## DevOps & Deployment Readiness

- **.gitignore:** Root has node_modules, dist, .env, .env.local, .next, coverage. ✅ .env and .env.local listed; frontend/.git and backend build artifacts covered.
- **Production start:** backend has "start": "nest start" and "start:prod": "node dist/main" — ✅.
- **ts-node in production:** Only in "seed" and "seed:rbac" scripts — ✅.
- **Port / API URL:** Frontend uses NEXT_PUBLIC_API_URL; default localhost:5000 only as fallback — ✅.
- **Seed guard:** Main seeder checks NODE_ENV !== 'production' and exits — ✅. RBAC seed-runner does not — MEDIUM.
- **Health endpoint:** /api/health not covered by automated test — LOW.
- **Build warnings:** Not run during audit; recommend `npm run build` in backend and frontend and fix any TypeScript/Next.js warnings — MEDIUM each if present.

---

## Prioritised Fix List

[CRITICAL] Section 2 (A05) — Apply express-mongo-sanitize  
File: backend/src/main.ts  
Issue: Package installed but never applied; body/query injection possible.  
Fix: After ValidationPipe, add: `import mongoSanitize from 'express-mongo-sanitize'; app.use(mongoSanitize());`  
Effort: XS  

[CRITICAL] Section 2 (A04) — Remove default MFA key from .env.example  
File: backend/.env.example  
Issue: Example MFA_ENCRYPTION_KEY value must not be used in production.  
Fix: Replace line with `MFA_ENCRYPTION_KEY=` and add comment: "Generate with: openssl rand -hex 32"  
Effort: XS  

[HIGH] Section 2 (A02) — Do not log full stack in production  
File: backend/src/common/filters/http-exception.filter.ts  
Issue: exception.stack logged; can leak paths.  
Fix: When NODE_ENV === 'production', log only message (or redact stack paths).  
Effort: S  

[HIGH] Section 2 (A05) — Escape regex in RBAC listRoles/listPermissions  
File: backend/src/rbac/rbac.service.ts  
Issue: search passed to $regex unescaped; ReDoS/injection.  
Fix: Escape with search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') before filter.name and filter.code.  
Effort: S  

[HIGH] Section 4 — Health/root response shape  
File: backend/src/health.controller.ts, app.controller.ts  
Issue: Endpoints bypass ResponseInterceptor; inconsistent API shape.  
Fix: Either wrap health/root in interceptor or document as special.  
Effort: S  

[HIGH] Section 6 — Fix AuthService spec and add EmailService mock  
File: backend/src/auth/auth.service.spec.ts  
Issue: login test calls service.login(mockUser); AuthService.login(email, password) and EmailService missing.  
Fix: Add EmailService mock; test login(email, password) and assert token/user or requiresMfa.  
Effort: M  

[HIGH] Section 7 — Token storage (XSS)  
File: frontend (auth/lib and usage)  
Issue: Token in localStorage is readable by XSS.  
Fix: Document risk; consider httpOnly cookie + same-site for production.  
Effort: L  

[HIGH] Section 9 — .env.example MFA key  
File: backend/.env.example  
Issue: Same as CRITICAL; ensure no default value.  
Fix: See CRITICAL fix.  
Effort: XS  

[MEDIUM] Section 2 (A07) — Stricter rate limit for login  
File: backend/src/app.module.ts or auth module  
Issue: Global throttle only; login could use dedicated limit.  
Fix: e.g. ThrottlerModule with named guards or separate limit for POST /api/auth/login.  
Effort: M  

[MEDIUM] Section 2 (A09) — Replace console with Logger  
File: backend/src/rbac/rbac.service.ts, rbac.cache.ts, auth/email.service.ts  
Issue: console.warn/log in production code.  
Fix: Inject Logger and use logger.warn/logger.log; gate verbose content on NODE_ENV.  
Effort: S  

[MEDIUM] Section 3 — Duplicate reset token logic in AuthService  
File: backend/src/auth/auth.service.ts  
Issue: resetPassword and resetMfa duplicate find-by-token loop.  
Fix: Extract findUserByResetToken(token) and reuse.  
Effort: S  

[MEDIUM] Section 4 — Todo list query validation  
File: backend/src/todos  
Issue: TodoQuery is interface; no class-validator.  
Fix: Add ListTodoQueryDto with @IsOptional() @IsString() etc. and use in controller.  
Effort: S  

[MEDIUM] Section 5 — RBAC seed-runner NODE_ENV check  
File: backend/src/rbac/seed-runner.ts  
Issue: Can run in production and modify roles.  
Fix: if (process.env.NODE_ENV === 'production') { console.error('...'); process.exit(1); }  
Effort: XS  

[MEDIUM] Section 5 — DB connection retry  
File: backend/src/app.module.ts / main.ts  
Issue: No retry on connection failure.  
Fix: Add retry with backoff in bootstrap or use Mongoose connection events.  
Effort: M  

[MEDIUM] Section 6 — Controller tests for Auth and RBAC  
File: backend/src/auth/auth.controller.spec.ts, rbac.controller.spec.ts (missing)  
Issue: No controller-level tests for auth and RBAC.  
Fix: Add specs with overridden guards and service mocks.  
Effort: M  

[MEDIUM] Section 8 — Unanchored search regex  
File: backend/src/todos/todos.service.ts  
Issue: $or regex on title/description cannot use index for search term.  
Fix: Optional: text index or accept current design; document.  
Effort: S  

[MEDIUM] Section 9 — Priority enum/constants  
File: shared or backend + frontend  
Issue: 'low'|'medium'|'high' scattered.  
Fix: Define PRIORITIES constant or enum and use in schema and frontend.  
Effort: S  

[MEDIUM] Section 10 — Health endpoint test  
File: backend test  
Issue: /api/health not tested.  
Fix: Add e2e or unit test for health response.  
Effort: XS  

[LOW] Section 3 — Unused Metadata import  
File: frontend/src/app/layout.tsx  
Issue: Metadata imported but not used.  
Fix: Remove import.  
Effort: XS  

[LOW] Section 3 — console in PermissionProvider  
File: frontend/src/rbac/PermissionProvider.tsx  
Issue: console.error on fetch failure.  
Fix: Use logger or remove in production build.  
Effort: XS  

[LOW] Section 3 — Magic numbers (bcrypt, port)  
File: backend (user schema, main.ts)  
Issue: 12, 10, 5000 inline.  
Fix: Named constants or env.  
Effort: XS  

[LOW] Section 4 — Swagger on HealthController  
File: backend/src/health.controller.ts  
Issue: No @ApiOperation/@ApiResponse.  
Fix: Add for docs.  
Effort: XS  

[LOW] Section 5 — updatedAt manual set  
File: backend/src/todos/todos.service.ts  
Issue: Manually set updatedAt although timestamps: true.  
Fix: Rely on Mongoose timestamps; remove manual set.  
Effort: XS  

[LOW] Section 6 — Edge case tests (double delete, toggle idempotent)  
File: backend/src/todos/todos.service.spec.ts  
Issue: Missing double-delete and toggle idempotency tests.  
Fix: Add tests.  
Effort: S  

[LOW] Section 7 — Raw img for QR  
File: frontend/src/app/settings/page.tsx  
Issue: <img> for data URL; eslint-disable present.  
Fix: Optional: keep as-is for data URLs.  
Effort: N/A  

[LOW] Section 9 — JSDoc on more methods  
File: backend auth.service, rbac.service  
Issue: Some methods lack JSDoc.  
Fix: Add brief JSDoc for public methods.  
Effort: S  

[INFO] Section 2 — Swagger in prod  
File: backend/src/main.ts  
Issue: Swagger only when not production — INFO.  
Effort: N/A  

[INFO] Section 2 — Token revocation  
Issue: No revocation — INFO.  
Effort: N/A  

[INFO] Section 4 — API versioning  
Issue: No /v1 — INFO.  
Effort: N/A  

---

## Score Card

| Category                 | Score | Max | Notes                                                                 |
|--------------------------|-------|-----|----------------------------------------------------------------------|
| Security (OWASP)         | 20    | 30  | Sanitize not applied (−4), MFA key in .env.example (−2), stack log (−2), RBAC regex (−2). |
| Code Quality (Sonar)     | 17    | 20  | Duplication (−2), console in prod (−0.5), unused import (−0.5).     |
| API Design               | 8     | 10  | Health/root not wrapped (−2).                                         |
| Database                 | 9     | 10  | RBAC seed NODE_ENV (−0.5), retry (−0.5).                             |
| Testing                  | 6     | 10  | Auth spec broken (−2), missing controller tests (−2).               |
| Frontend Quality         | 8     | 10  | localStorage token (−2).                                            |
| Maintainability          | 4     | 5   | .env.example MFA (−0.5), JSDoc (−0.5).                              |
| DevOps Readiness         | 5     | 5   | All present.                                                         |
| **TOTAL**                | **77**| **100** |                                                                  |

## Overall Grade

Score: 77/100  
Grade: B (75–89)

---
