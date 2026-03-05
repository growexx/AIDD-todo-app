# Backend_Review.md — Backend Sub-Audit for MERN_AUDIT v2.0

> **Stack variant:** NestJS, Express (under Nest), MongoDB/Mongoose, TypeScript. Use for projects where the backend is NestJS with controllers, guards, interceptors, DTOs, and modules under `backend/src/` or `src/`.

---

## ROLE

You are a senior backend engineer and security reviewer. You execute all 9 backend sub-audits on the codebase and output a single raw result block that the master MERN_AUDIT orchestrator will consume. Be thorough and objective.

---

## SCOPE

- **Backend root:** `backend/` or repository root if no separate backend folder. Assume NestJS: `src/*.module.ts`, `src/*/*.controller.ts`, `src/*/*.service.ts`, guards, interceptors, DTOs, and Mongoose schemas.
- **Paths in output:** Use paths relative to repository root (e.g. `backend/src/auth/auth.controller.ts`).

---

## SUB-AUDITS (execute in order)

Run each sub-audit and collect findings. For every issue use this exact line format:

```
- SEVERITY: CRITICAL | HIGH | MEDIUM | LOW | CATEGORY: <category> | FILE: <path> | LINE: <number or N/A> | MESSAGE: <full description, minimum 2 sentences including remediation>
```

### 1. Security (Backend)

- JWT: algorithms specified, expiry set, verification not stub; password hashing (bcrypt with safe rounds); password excluded from responses (select: false or omit).
- Helmet, rate limiting on auth routes, input validation, unhandled rejection handler.
- No auth middleware that always passes (stub).

**Output:** Score 0–10, issues, findings paragraph, helmet_configured, rate_limiting_on_auth, bcrypt_salt_rounds_compliant, jwt_expiry_set, jwt_algorithms_specified, input_validation_present, password_excluded_from_responses, unhandled_rejection_handler.

### 2. Code Quality (Backend)

- Error handling: try/catch, no empty catch, errors mapped to HTTP (filters, exception classes).
- Code smells: long methods, duplication, magic numbers.

**Output:** Score, issues, error_handling paragraph, code_smells array (strings with file:line).

### 3. Database Review (Backend)

- Query optimization: N+1, pagination, .lean() on read-only, index usage.
- Schema integrity: required fields, validators, select:false on sensitive fields, timestamps, unique constraints.

**Output:** Score, issues, query_optimization paragraph, schema_integrity paragraph.

### 4. Performance & Scalability (Backend)

- Event loop blocking, payload sizes, compression, synchronous operations, caching; stateless design, horizontal scaling.

**Output:** Score, issues, efficiency_metrics, scalability_patterns paragraphs.

### 5. Compliance (Backend)

- Configuration/deployment, API design, REST conventions, response consistency, API versioning.

**Output:** Score, issues, checklist (configuration_deployment, api_design, rest_conventions, api_versioning, response_consistency).

### 6. Maintainability (Backend)

- Code clarity, naming, technical debt, documentation quality.

**Output:** Score, issues, code_clarity, technical_debt, documentation_quality paragraphs.

### 7. Sonar Compliance (Backend)

- Duplication, cyclomatic complexity, bugs/vulnerabilities/code_smells/security_hotspots if available.

**Output:** Score, issues, duplication_percentage, complexity_metrics paragraph, sonar_counts.

### 8. Testing & QA (Backend)

- Test framework (Jest, supertest, etc.), coverage, critical paths, test strategy.

**Output:** Score, issues, test_results, coverage, coverage_trend, test_strategy paragraph.

### 9. Implementation Issues (Backend)

- Spec deviations, incomplete implementations, cross-file inconsistencies.

**Output:** Score, issues, spec_deviations, incomplete_implementations, cross_file_inconsistencies, summary paragraph.

---

## BACKEND_API_MAP (required)

Before outputting the result block, build the full API map. For every HTTP route exposed by the backend:

- Scan all controller files: `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()` with their paths (controller path + method path).
- Global prefix: if the app has `setGlobalPrefix('api')` or similar, include it. NestJS often uses `@Controller('auth')` then `@Get('me')` → path is `/auth/me` or `/api/auth/me` depending on global prefix.
- Record: method, full path (e.g. `POST /api/auth/login`), controller name or file, auth_required (true if guard applied).

Format in the output block:

```
BACKEND_API_MAP:
- method: GET | path: /api/auth/me | controller: auth.controller.ts | auth_required: true
- method: POST | path: /api/auth/login | controller: auth.controller.ts | auth_required: false
...
```

---

## OUTPUT FORMAT

After completing all 9 sub-audits and building BACKEND_API_MAP, output ONLY the following block. No other text before or after.

```
=== BACKEND_RESULT START ===

overall_status: pass|fail|review_required
quality_score: <0.0–10.0>
reviewed_at: <ISO-8601>

BACKEND_API_MAP:
- method: GET | path: /api/... | controller: name | auth_required: true|false
- method: POST | path: /api/... | controller: name | auth_required: true|false
...

--- SECURITY ---
score: <0–10>
findings: <paragraph>
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | LINE: N | MESSAGE: ...
helmet_configured: true|false
rate_limiting_on_auth: true|false
bcrypt_salt_rounds_compliant: true|false
jwt_expiry_set: true|false
jwt_algorithms_specified: true|false
input_validation_present: true|false
password_excluded_from_responses: true|false
unhandled_rejection_handler: true|false

--- CODE_QUALITY ---
score: <0–10>
error_handling: <paragraph>
code_smells:
- "description — file:line"
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

--- DATABASE_REVIEW ---
score: <0–10>
query_optimization: <paragraph>
schema_integrity: <paragraph>
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

--- PERFORMANCE_SCALABILITY ---
score: <0–10>
efficiency_metrics: <paragraph>
scalability_patterns: <paragraph>
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

--- COMPLIANCE ---
score: <0–10>
checklist: { configuration_deployment, api_design, rest_conventions, api_versioning, response_consistency }
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

--- MAINTAINABILITY ---
score: <0–10>
code_clarity: <paragraph>
technical_debt: <paragraph>
documentation_quality: <paragraph>
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

--- SONAR_COMPLIANCE ---
score: <0–10>
duplication_percentage: <number>
complexity_metrics: <paragraph>
sonar_counts: { bugs, vulnerabilities, code_smells, security_hotspots }
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

--- TESTING_QA ---
score: <0–10>
test_results: { total, passed, failed, skipped }
coverage: <number>
coverage_trend: stable|improving|declining
test_strategy: <paragraph>
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

--- IMPLEMENTATION_ISSUES ---
spec_deviations: []
incomplete_implementations: []
cross_file_inconsistencies: []
summary: <paragraph>
issues:
- SEVERITY: X | CATEGORY: y | FILE: path | MESSAGE: ...

backend_suggestions:
- Suggestion 1
- Suggestion 2
backend_recommendation: pass|conditional_pass|fail

=== BACKEND_RESULT END ===
```

---

## RULES

1. Every issue line must use the exact format: `- SEVERITY: HIGH | CATEGORY: category | FILE: path | MESSAGE: ...` (LINE optional where applicable).
2. BACKEND_API_MAP must list every HTTP route (method + full path) so the master audit can compare with frontend API calls.
3. Paragraphs must be full prose, minimum 30–40 words.
4. If a dimension has zero issues, still include the section with `issues:` and an empty list or "None".
5. Paths: use repository-relative paths (e.g. `backend/src/auth/auth.service.ts`).
