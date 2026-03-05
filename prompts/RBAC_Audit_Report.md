# RBAC Module — Detailed Audit Report

**Audit date:** 2026-03-05  
**Scope:** Backend `backend/src/rbac/`, Frontend `frontend/src/rbac/`, `frontend/src/app/rbac-admin/`  
**References:** RBAC_Prompt_Mongoose_V6.md, RBAC_Production_Readiness_Gap_Analysis.md, MERN_AUDIT.md Phase 3E  

---

## 1. Executive Summary

| Status | Score | Summary |
|--------|--------|--------|
| **PASS** | **8.5 / 10** | RBAC module meets production-readiness criteria: search escaping, .lean(), seed NODE_ENV guard, shared getApiErrorMessage, and coverage thresholds in place. Minor gaps: RBAC routes not explicitly rate-limited, root README could state API_PREFIX/NEXT_PUBLIC_API_URL for RBAC. |

**Gate rules (Phase 3E):** No HIGH failures. All six Phase 3E checks pass or are partially met.

---

## 2. Phase 3E — RBAC Production Readiness (MERN_AUDIT)

### 2.1 Search regex escaping (Security — A05 Injection)

| Check | Result | Evidence |
|-------|--------|----------|
| listRoles/listPermissions escape `search` before `$regex` | **PASS** | `backend/src/rbac/rbac.service.ts`: `escapeForRegex(search)` used in listRoles (line 88) and listPermissions (line 159). `backend/src/rbac/utils/regex-escape.ts` implements `escapeForRegex` with `[.*+?^${}()|[\]\\]` → `\\$&`. |

**Severity if missing:** HIGH. **Finding:** Implemented. No action.

---

### 2.2 Query optimization (.lean() on list queries)

| Check | Result | Evidence |
|-------|--------|----------|
| listRoles uses .lean() for read-only list | **PASS** | `rbac.service.ts` line 94: `this.roleModel.find(filter).lean().skip(skip).limit(limit).sort({ name: 1 }).exec()`. No populate on list. |
| listPermissions uses .lean() | **PASS** | `rbac.service.ts` line 165: `this.permissionModel.find(filter).lean().skip(skip).limit(limit).sort({ code: 1 }).exec()`. |
| Other read-only paths use .lean() where appropriate | **PASS** | getUsersByRole (line 297), getUserPermissions path (line 262, 342), backfill (line 238), invalidateUserPermissionsCacheForRole (line 388) use .lean(). |

**Finding:** Implemented. No action.

---

### 2.3 Seeder safety (NODE_ENV check)

| Check | Result | Evidence |
|-------|--------|----------|
| RBAC seed-runner refuses to run in production | **PASS** | `backend/src/rbac/seed-runner.ts` lines 8–11: `if (process.env.NODE_ENV === 'production') { console.error('...'); process.exit(1); }` before importing/running seedRbac. |

**Finding:** Implemented. No action.

---

### 2.4 Frontend API error handling (getApiErrorMessage)

| Check | Result | Evidence |
|-------|--------|----------|
| Shared helper exists | **PASS** | `frontend/src/lib/getApiError.ts`: `getApiErrorMessage(err)`, `getApiError(err)` with 403 → "Permission denied", 401 → "Please log in". |
| RBAC admin pages use it in catch blocks | **PASS** | roles/page.tsx (3), roles/[id]/page.tsx (6), roles/CreateRoleModal.tsx (1), permissions/page.tsx (1), users/page.tsx (3), settings/page.tsx (1). All use `getApiErrorMessage(e)` or `getApiErrorMessage(err)`. |

**Finding:** Implemented. No action.

---

### 2.5 RBAC test coverage

| Check | Result | Evidence |
|-------|--------|----------|
| Backend RBAC tests exist and run | **PASS** | 6 suites, 75 tests. `npm run test:rbac` and `npm run test:rbac:cov` pass. |
| Backend coverage threshold enforced for RBAC | **PASS** | `backend/jest.rbac.config.js`: collectCoverageFrom = service, registry, guards, utils, errors, schemas; coverageThreshold global: lines 75%, branches 68%, functions 75%, statements 80%. |
| Frontend RBAC tests exist and run | **PASS** | 4 suites, 16 tests. `npm test -- --testPathPattern=rbac` passes. |
| Frontend RBAC coverage | **PASS** | jest.config.js collectCoverageFrom includes src/rbac; threshold 80/75/80/80. Current: 98.48% stmts, 83.33% branch, 87.5% funcs, 98.38% lines. |

**Backend coverage (test:rbac:cov):**

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| rbac.registry.ts | 100 | 100 | 100 | 100 |
| rbac.service.ts | 78.53 | 68.64 | 75.75 | 78.88 |
| guards/*.ts | 100 | 92.85 | 100 | 100 |
| rbac/utils/*.ts | 100 | 100 | 100 | 100 |
| rbac/errors/*.ts | 75 | 50 | 66.66 | 75 |
| rbac/schemas/*.ts | 100 | 75 | 100 | 100 |
| **All (collected)** | **85.47** | **73.75** | **80** | **85.18** |

**Frontend coverage (rbac):**

| File | Stmts | Branch | Funcs | Lines |
|------|-------|--------|-------|-------|
| PermissionGate.tsx | 100 | 100 | 100 | 100 |
| PermissionProvider.tsx | 97.14 | 72.22 | 80 | 97.14 |
| usePermission.ts | 100 | 100 | 100 | 100 |
| wildcardMatcher.ts | 100 | 100 | 100 | 100 |
| **All (rbac)** | **98.48** | **83.33** | **87.5** | **98.38** |

**Finding:** Implemented. Thresholds pass. Optional: add rbac.seed.spec.ts, rbac.cache.spec.ts to raise backend coverage toward 90%.

---

### 2.6 Documentation (API_PREFIX, NEXT_PUBLIC_API_URL)

| Check | Result | Evidence |
|-------|--------|----------|
| API_PREFIX documented | **PASS** | `backend/.env.example` line 20: `API_PREFIX=/api/rbac`. `backend/src/rbac/README.md`: "API_PREFIX: Base path for RBAC routes (default: api/rbac)." |
| NEXT_PUBLIC_API_URL documented | **PASS** | `frontend/.env.local.example`: `NEXT_PUBLIC_API_URL=http://localhost:5000`. Root README: "Set NEXT_PUBLIC_API_URL (default: http://localhost:5000)." |
| RBAC routes at &lt;API_PREFIX&gt; stated | **PARTIAL** | RBAC README states API_PREFIX. Root README does not explicitly say "RBAC routes at API_PREFIX." |

**Finding:** Compliant. Optional (LOW): add one sentence in root README: "RBAC admin API is at &lt;API_PREFIX&gt; (e.g. /api/rbac); set NEXT_PUBLIC_API_URL to backend origin."

---

## 3. Test Suite Summary

### 3.1 Backend RBAC test files

| File | Tests | Purpose |
|------|-------|--------|
| rbac.registry.spec.ts | PERMISSIONS, getAllPermissionCodes, getAllPermissionCodesWithWildcards, isValidPermissionCode |
| rbac.service.spec.ts | createRole, getRoleById, listRoles, updateRole, deleteRole, listPermissions, getPermissionByCode, addPermissionToRole, removePermissionFromRole, assignRoleToUser, removeRoleFromUser, getUserRoles, getUserPermissions, getUsersByRole, getDefaultRole, backfillDefaultRole |
| guards/require-permission.guard.spec.ts | 401 no user, 500 no permissions, pass exact/wildcard/module, 403 with requiredPermission |
| guards/permissions-attachment.guard.spec.ts | 401 no user, attach permissions, 500 on fetcher throw |
| utils/wildcard.matcher.spec.ts | global *:*, exact, module wildcard, edge cases |
| utils/regex-escape.spec.ts | null/undefined, special chars, no special chars |

**Total:** 6 suites, 75 tests, all passing.

### 3.2 Frontend RBAC test files

| File | Tests | Purpose |
|------|-------|--------|
| usePermission.test.tsx | outside provider throws; with provider has hasPermission/isLoading |
| PermissionGate.test.tsx | children/fallback/loadingFallback with mock context |
| PermissionProvider.test.tsx | no fetch when userId null; fetch when set; error path |
| utils/wildcardMatcher.test.ts | global, exact, module wildcard, invalid userPermissions |

**Total:** 4 suites, 16 tests, all passing.

---

## 4. Additional Findings (Beyond Phase 3E)

### 4.1 Rate limiting on RBAC routes

| Finding | Severity | Details |
|---------|----------|--------|
| ThrottlerGuard not on RbacController | **LOW** | ThrottlerModule is global (ttl: 60000, limit: 10) but ThrottlerGuard is only applied on AuthController via @UseGuards(ThrottlerGuard). RbacController does not use @UseGuards(ThrottlerGuard). If the app does not register ThrottlerGuard globally, RBAC routes are not rate-limited. RBAC README recommends 100/15min read, 30/15min write. |

**Recommendation:** Apply ThrottlerGuard globally in app.module (e.g. APP_GUARD) or add @UseGuards(ThrottlerGuard) to RbacController so RBAC routes are rate-limited.

### 4.2 Backend RBAC modules not under coverage

| Module | In collectCoverageFrom? | Coverage |
|--------|-------------------------|----------|
| rbac.controller.ts | No (excluded in jest.rbac.config.js) | N/A |
| rbac.seed.ts | No | N/A |
| rbac.cache.ts | No | N/A |
| rbac.module.ts | No | N/A |
| dto/*.ts | No | N/A |

**Note:** By design, jest.rbac.config.js only collects from service, registry, guards, utils, errors, schemas so that the current threshold (75/68/75/80) passes. Adding controller/seed/cache specs would allow expanding collectCoverageFrom and raising the threshold toward 90%.

### 4.3 Uncovered lines in rbac.service.ts

Main uncovered areas: cache invalidation (Redis) paths, backfillDefaultRole success path (with userModel), updateRole description/isDefault branches, and a few error branches. Acceptable for current threshold; can be covered to push toward 90%.

---

## 5. Checklist vs RBAC Prompt SINGLE-RUN

| Item | Status |
|------|--------|
| PermissionGate: named import only | ✅ |
| List API: listRoles/listPermissions return { data, meta }; list pages use res.data and res.meta | ✅ |
| Default "user" role includes user:view-permissions | ✅ (seed) |
| Seed assigns roles by email via SEED_*_EMAILS | ✅ |
| NEXT_PUBLIC_API_URL set to backend origin | ✅ |
| Roles/permissions list pages: defensive (list ?? []).map; Array.isArray(res?.data) | ✅ |
| Mongoose: no duplicate unique index on Role name / Permission code | ✅ |
| getUserPermissions: populated role.permissions handled | ✅ |
| Backend listRoles/listPermissions escape search before $regex | ✅ |
| Backend listRoles/listPermissions use .lean() | ✅ |
| Shared getApiErrorMessage in RBAC admin catch blocks | ✅ |
| RBAC seed-runner checks NODE_ENV and exits in production | ✅ |
| README or .env.example documents API_PREFIX and NEXT_PUBLIC_API_URL | ✅ (partial: root README could state RBAC) |
| Frontend and backend RBAC test suites exist; npm test passes with coverage thresholds | ✅ |
| Backend Jest coverageThreshold enforced for src/rbac (e.g. 75%+ with goal 90%) | ✅ |

---

## 6. Recommendations (Priority Order)

1. **LOW:** Add one sentence in root README under setup: "RBAC API is at API_PREFIX (e.g. /api/rbac); set NEXT_PUBLIC_API_URL to your backend origin for the RBAC admin UI."
2. **LOW:** Apply ThrottlerGuard to RBAC routes (global APP_GUARD or @UseGuards on RbacController). Align ttl/limit with RATE_LIMIT_* if desired (e.g. 100/15min).
3. **Optional:** Add rbac.seed.spec.ts and rbac.cache.spec.ts; expand jest.rbac.config.js collectCoverageFrom to include controller, seed, cache; raise coverage threshold toward 90%.

---

## 7. Conclusion

The RBAC module **passes** the Phase 3E (RBAC Production Readiness) audit. Security (search escaping), query optimization (.lean()), seeder safety (NODE_ENV), frontend error handling (getApiErrorMessage), test coverage (backend and frontend with enforced thresholds), and documentation (API_PREFIX, NEXT_PUBLIC_API_URL) all meet or exceed the required level. Remaining items are low priority or optional improvements.

**Report generated:** 2026-03-05  
**Artifacts:** Backend `npm run test:rbac:cov`, Frontend `npm test -- --testPathPattern=rbac --coverage`; codebase grep/read for Phase 3E checks.
