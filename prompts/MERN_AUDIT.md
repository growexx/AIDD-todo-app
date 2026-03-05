# 🔍 MERN_AUDIT.md — Master Audit Orchestrator v2.0

> **Stack:** MERN (MongoDB, Express.js, React, Node.js). **Stack variant (NestJS + Next.js):** Backend may be NestJS (controllers, guards, interceptors under `backend/src/`); frontend may be Next.js (App Router, `frontend/src/app/`). Use `NEXT_PUBLIC_API_URL` for frontend API base URL; backend may run on a different PORT (e.g. 5001). API routes are defined by NestJS controller decorators (e.g. `@Controller('api/auth')`, `@Get('me')`) rather than Express router files.
> **Purpose:** Execute the complete full-stack audit, collect raw findings from Frontend_Review.md and Backend_Review.md, perform cross-layer analysis, and render the ENTIRE final report in the mandatory format defined in this file.

---

## ROLE

You are a world-class senior full-stack engineer, security architect, and production-readiness gatekeeper. You orchestrate the complete MERN audit and produce the final human-readable report. Be thorough, unforgiving, and objective. This is a gate review — the output determines whether the application proceeds to production.

---

## PHASE 1 — EXECUTE FRONTEND REVIEW

Execute `Frontend_Review.md` in full. It will run all 9 frontend sub-audits and return a raw `=== FRONTEND_RESULT START === ... === FRONTEND_RESULT END ===` block.

Capture that block as `FRONTEND_RESULT`.

**Do not render any output yet.**

---

## PHASE 2 — EXECUTE BACKEND REVIEW

Execute `Backend_Review.md` in full. It will run all 9 backend sub-audits and return a raw `=== BACKEND_RESULT START === ... === BACKEND_RESULT END ===` block.

Capture that block as `BACKEND_RESULT`.

**Do not render any output yet.**

---

## PHASE 3 — CROSS-LAYER ANALYSIS

Using `FRONTEND_RESULT` and `BACKEND_RESULT`, perform the following analyses:

### 3A — API URL Consistency
Extract every API call from `FRONTEND_RESULT` (`API_CALLS_LIST` or `API_URL_MISMATCHES` section and `fe_ui_navigation_integrity` / `UI_NAVIGATION_INTEGRITY` issues).
Extract every route from `BACKEND_RESULT` (`BACKEND_API_MAP`). Backend routes are expressed as method + path (e.g. from NestJS controller method + path).
Build a comparison matrix. For every frontend API call, verify exact method + path match in the backend API map.
Flag every mismatch as HIGH severity.

### 3B — Auth Contract Consistency
- Verify JWT payload fields produced by backend (NestJS auth module or Express) match what frontend accesses
- Verify token storage mechanism alignment (backend cookie vs. frontend localStorage; Next.js often uses axios with Authorization header and localStorage)
- Verify logout clears token in the same place it was stored
- Verify 401 handling is consistent across both layers (e.g. axios interceptor redirect to login)

### 3C — Data Contract Consistency
- Verify field names in frontend form submissions match backend expected fields and Mongoose schema fields
- Verify response shapes: backend `{ success, data, message }` → frontend access pattern matches
- Verify error response format matches frontend error parsing

### 3D — Environment & Configuration Consistency
- Frontend API base URL: `NEXT_PUBLIC_API_URL` (Next.js) or `VITE_API_BASE_URL` / `REACT_APP_API_URL` → must match backend origin and PORT (e.g. `http://localhost:5001` if backend runs on 5001)
- CORS origin in backend → matches frontend dev URL and production domain
- Both layers use same API versioning scheme (or neither do — flag if inconsistent)
- Env var validation at startup on both layers

### 3E — RBAC Production Readiness (when RBAC module present)

If the application includes an RBAC module (e.g. `backend/src/rbac/`, `frontend/src/rbac/`, or `frontend/src/app/rbac-admin/`), perform the following checks and add any failures to the appropriate dimension (Security Backend, Database, Testing, Implementation, Code Quality). Use `prompts/RBAC_Production_Readiness_Gap_Analysis.md` as the authoritative checklist.

1. **Search regex escaping (Security Backend — A05 Injection):** In `listRoles` and `listPermissions` (or equivalent), the `search` parameter must be escaped before use in a `$regex` filter (e.g. `search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`). Unescaped user input → ReDoS/regex injection. Flag as HIGH if missing.
2. **Query optimization (Database):** List endpoints for roles and permissions must use `.lean()` for read-only list queries where applicable. Flag as MEDIUM if list queries return full Mongoose documents without `.lean()`.
3. **Seeder safety (Database / Implementation):** The RBAC seed-runner (script that invokes `seedRbac()` or equivalent) must check `NODE_ENV` and must not run (or must exit with error) when `NODE_ENV === 'production'`. Flag as MEDIUM if absent.
4. **Frontend API error handling (Code Quality Frontend):** RBAC admin pages (roles, permissions, users, settings) must use a shared helper (e.g. `getApiErrorMessage(err)`) in catch blocks for consistent 403/401/generic messages. Flag as MEDIUM if only ad hoc error handling is present.
5. **RBAC test coverage (Testing Backend/Frontend):** Backend must enforce a coverage threshold for the RBAC module (e.g. `src/rbac/**` with lines/branches/functions/statements ≥90%). Frontend RBAC tests must exist and meet the project’s threshold. Flag as MEDIUM if backend has no RBAC coverage threshold or frontend has no RBAC tests.
6. **Documentation (Compliance):** README or `.env.example` must document `API_PREFIX` (backend) and `NEXT_PUBLIC_API_URL` (frontend) and that RBAC routes live at `<API_PREFIX>`. Flag as LOW if missing.

Record RBAC alignment results in the Executive Summary under "Gate Rule Triggers" or "Critical & High Issues Summary" as applicable.

---

## PHASE 4 — MASTER SCORING

```
Overall Quality Score = (Frontend Quality Score × 0.45) + (Backend Quality Score × 0.55)
```

**Overall Status Rules:**

| Condition | Status |
|---|---|
| Either layer status = `fail` | `fail` |
| Any CRITICAL security issue (either layer) | `fail` |
| Password stored without hashing | `fail` |
| Auth middleware stub (always passes) | `fail` |
| Zero tests on either layer | `fail` |
| Any cross-layer API mismatch (HIGH) | `review_required` |
| Either layer status = `review_required` | `review_required` |
| Any HIGH AI pattern on either layer | `review_required` |
| Overall score < 6.0 | `fail` |
| Overall score 6.0–7.4 | `review_required` |
| Overall score ≥ 7.5, no CRITICAL/HIGH issues | `pass` |

**Recommendation:**

| Status | Recommendation |
|---|---|
| `fail` | `fail` |
| `review_required` | `conditional_pass` |
| `pass` | `pass` |

---

## PHASE 5 — RENDER FINAL REPORT & OUTPUT TO FILE

After completing all phases (Frontend Review, Backend Review, Cross-Layer Analysis, and Master Scoring), write the **entire audit output** to a single file named `audit.md`.

---

### ⚠️ CRITICAL FORMAT RULES — READ BEFORE WRITING

These rules override all other formatting instructions. Every violation produces an unusable report.

**Rule 1 — Dimension order is interleaved by topic, NOT grouped by layer.**
Do NOT write all frontend dimensions first, then all backend dimensions. The correct order is:
```
DIMENSION 1  — SECURITY (Backend)
DIMENSION 2  — SECURITY (Frontend)
DIMENSION 3  — CODE QUALITY (Backend)
DIMENSION 4  — CODE QUALITY (Frontend)
DIMENSION 5  — DATABASE REVIEW
DIMENSION 6  — COMPLIANCE (Backend)
DIMENSION 7  — COMPLIANCE (Frontend)
DIMENSION 8  — PERFORMANCE (Backend)
DIMENSION 9  — PERFORMANCE (Frontend)
DIMENSION 10 — MAINTAINABILITY (Backend)
DIMENSION 11 — MAINTAINABILITY (Frontend)
DIMENSION 12 — SONAR COMPLIANCE (Backend)
DIMENSION 13 — SONAR COMPLIANCE (Frontend)
DIMENSION 14 — TESTING & QA (Backend)
DIMENSION 15 — TESTING & QA (Frontend)
DIMENSION 16 — IMPLEMENTATION ISSUES (Backend)
DIMENSION 17 — IMPLEMENTATION ISSUES (Frontend)
DIMENSION 18 — UI NAVIGATION INTEGRITY & ROUTE CONSISTENCY
DIMENSION 19 — CROSS-LAYER ANALYSIS
```

**Rule 2 — Every dimension section uses the EXACT heading format:**
```
## DIMENSION N — [NAME] — Score: X.X/10
```
Never use `###`, never use `FRONTEND SECURITY`, never use grouped headers like `### FRONTEND DIMENSIONS`.

**Rule 3 — Every issue uses the EXACT issue line format:**
```
[Severity: HIGH] `category` — `path/to/file.js` line N — Full description of the issue including why it is dangerous and the exact remediation. This must be at least two sentences.
```

**Rule 4 — Named narrative fields are full prose paragraphs.**
Every named field (`error_handling`, `code_smells`, `query_optimization`, `schema_integrity`, `efficiency_metrics`, `scalability_patterns`, `code_clarity`, `technical_debt`, `documentation_quality`, `duplication_percentage`, `complexity_metrics`, `test_strategy`, `coverage_trend`, `navigation_audit`, `route_coverage`, `api_url_consistency`, `findings`, `summary`) must appear after **Issues Found** and before **Key Finding**, and must be written as full prose with minimum word counts as specified. They must NOT be one-liner summaries.

**Rule 5 — Do NOT wrap the Executive Summary or dimension narrative sections in code blocks.**
Only the JSON in Section 3 is wrapped in a ` ```json ` code block.

**Rule 6 — JSON `issues` arrays must be FULLY POPULATED from the raw findings.**
Every issue found during the sub-audits (from `FRONTEND_RESULT` and `BACKEND_RESULT`) MUST appear as a JSON object in the corresponding `issues` array. An empty `"issues": []` is only valid if the sub-audit genuinely found zero issues. The model must translate every `- SEVERITY: HIGH | CATEGORY: ... | FILE: ... | MESSAGE: ...` line from the raw findings into a JSON object: `{"severity": "high", "category": "...", "file": "...", "message": "..."}`.

**Rule 7 — JSON narrative string fields must be full prose, not one-liners.**
Every string field in the JSON that corresponds to a named narrative field (e.g., `"findings"`, `"error_handling"`, `"query_optimization"`, `"test_strategy"`, `"navigation_audit"`, etc.) must contain the full prose paragraph from the dimension narrative — not a compressed one-liner summary.

**Rule 8 — Never truncate.**
If a dimension has 7 issues, write all 7 in the narrative and all 7 in the JSON issues array. If the API table has 18 rows, write all 18 rows. "Truncated for brevity" is not permitted.

---

### File Writing Instructions

1. Create (or overwrite) a file named `audit.md` in the current working directory.
2. The file must contain **all three sections** in sequence, with no truncation.
3. Use the following file header at the very top:

```
# MERN APPLICATION — FULL AUDIT REPORT
# Generated: [ISO-8601 timestamp]
# Audit System: MERN_AUDIT v2.0
# Status: [PASS / FAIL / REVIEW REQUIRED]
# Overall Score: X.X / 10
---
```

---

### SECTION 1 — EXECUTIVE SUMMARY

Write `## SECTION 1 — EXECUTIVE SUMMARY` then produce a plain Markdown (no code block) block containing:

```
## Executive Summary

**Application:** [App name if identifiable, else "MERN Application"]
**Review Date:** [date]
**Overall Status:** [PASS | FAIL | REVIEW REQUIRED]
**Quality Score:** [X.X / 10]  (Frontend: X.X | Backend: X.X)
**Recommendation:** [pass | conditional_pass | fail]

### Gate Rule Triggers
[List every gate rule that fired with its effect. Example:]
- Zero tests on both layers → overall status = fail
- CRITICAL: password field missing select: false → overall status = fail
- HIGH: JWT verify without algorithms → score ≤ 6, cannot be "pass"
[When RBAC module is present: list any Phase 3E (RBAC Production Readiness) failures, e.g. unescaped search in listRoles/listPermissions → HIGH; seed-runner not checking NODE_ENV → MEDIUM. See prompts/RBAC_Production_Readiness_Gap_Analysis.md.]

### Critical & High Issues Summary
[List every CRITICAL and HIGH issue from all dimensions as a flat bulleted list, grouped by severity. Each item: bullet, severity tag, dimension name, file, one-sentence description.]

### Top 3 Must-Fix Before Production
1. [Most critical issue — what it is and why it blocks production]
2. [Second]
3. [Third]
```

---

### SECTION 2 — FULL DIMENSION NARRATIVE REPORT

Write `## SECTION 2 — FULL DIMENSION NARRATIVE REPORT`

Then write all 19 dimensions using the **exact repeating template** below.
**Dimensions are interleaved by topic in the order specified in Rule 1 above.**
Do NOT group frontend and backend separately.

#### Dimension Template (MANDATORY — no deviations)

```
---

## DIMENSION N — [NAME] — Score: X.X/10

**Summary:** [2–4 sentence narrative. Minimum 40 words. Describe what is present and working, what is missing or broken, and the overall posture for this dimension. No bullet points here — full prose only.]

**Issues Found:**

[Severity: HIGH] `category` — `path/to/file.js` line N — [Full description — what the exact problem is, why it is dangerous or harmful, and what the specific remediation is. Minimum 2 sentences per issue line.]

[Severity: MEDIUM] `category` — `path/to/file.js` — [Description. Minimum 2 sentences.]

[Severity: LOW] `category` — `path/to/file.js` — [Description.]

[Named narrative fields for this dimension — see list below]

**Key Finding:** [One sentence identifying the single most critical issue in this dimension.]
```

#### Named Narrative Fields by Dimension

Append these after Issues Found (and before Key Finding) for the dimensions that require them:

**Dimensions 3, 4 (Code Quality):**
```
**`error_handling`:** [Full prose paragraph — minimum 30 words describing try-catch coverage, empty/silent catch patterns, whether errors are surfaced to the user, async/await quality, and next(err) vs res.status() patterns.]

**`code_smells`:** [
  "Smell 1 — exact file path and line reference",
  "Smell 2 — exact file path and line reference",
  ...all smells found
]
```

**Dimension 5 (Database Review):**
```
**`query_optimization`:** [Full prose paragraph — minimum 30 words on query efficiency, N+1 patterns found, pagination presence or absence, index usage, .lean() usage on read-only paths. When an RBAC module is present (e.g. backend/src/rbac/), explicitly assess listRoles and listPermissions: (1) whether .lean() is used for read-only list queries, and (2) whether the search parameter is escaped before use in $regex (ReDoS/injection). See Phase 3E and RBAC_Production_Readiness_Gap_Analysis.md.]

**`schema_integrity`:** [Full prose paragraph — minimum 30 words on schema design quality: required fields, validators, select:false on sensitive fields, timestamps option, unique constraints. If RBAC is present, note whether the seed-runner checks NODE_ENV and refuses to run in production.]
```

**Dimensions 8, 9 (Performance):**
```
**`efficiency_metrics`:** [Full prose paragraph — minimum 30 words on event loop blocking, payload sizes, compression, synchronous operations, caching.]

**`scalability_patterns`:** [Full prose paragraph — minimum 30 words on stateless design, horizontal scaling readiness, session storage patterns, in-memory vs external state.]
```

**Dimensions 10, 11 (Maintainability):**
```
**`code_clarity`:** [Full prose paragraph — minimum 30 words on variable/function naming, naming conventions (camelCase, PascalCase), overall readability.]

**`technical_debt`:** [Full prose paragraph — minimum 30 words on TODO/FIXME count, commented-out code, duplicated logic, missing abstractions, deprecated patterns.]

**`documentation_quality`:** [Full prose paragraph — minimum 30 words on README completeness, JSDoc presence on controllers/hooks, inline comments on complex logic.]
```

**Dimensions 12, 13 (Sonar Compliance):**
```
**`duplication_percentage`:** [numeric only — e.g., 8.5]

**`complexity_metrics`:** [Full prose paragraph — minimum 30 words stating the maximum cyclomatic complexity found, which function it is in, average complexity across the codebase, and any functions exceeding 15.]
```

**Dimensions 14, 15 (Testing & QA):**
```
**`test_strategy`:** [Full prose paragraph — minimum 40 words describing what testing framework is present or absent, what is covered, which critical paths are completely untested, and what the minimum viable test suite should include.]

**`coverage_trend`:** [stable | improving | declining]
```

**Dimension 18 (UI Navigation Integrity):**

This dimension MUST include, in addition to the standard Issues Found block:

1. A **Broken Links** subsection (or "None found — all verified"):
```
**Broken Links:** None found. All Link/NavLink/navigate() targets verified against defined routes.
```
OR list each broken link.

2. A full **Route Coverage Table** in Markdown:
```
| Route Path | Element | Verified Reachable |
|---|---|---|
| /login | Login | ✓ |
| ... | ... | ✓ |
```
List EVERY defined route. Do not summarise.

3. A full **API URL Mismatch Table** in Markdown:
```
| Frontend Call | Method | Backend Route | Match |
|---|---|---|---|
| /api/auth/signup | POST | POST /api/auth/signup (NestJS controller or router) | ✓ |
| ... | ... | ... | ... |
```
List EVERY frontend API call. Do not summarise as "0 mismatches" without the table.

4. Named narrative fields:
```
**`navigation_audit`:** [Full prose paragraph — minimum 40 words.]

**`route_coverage`:** [Full prose paragraph — minimum 40 words.]

**`api_url_consistency`:** [Full prose paragraph — minimum 40 words.]
```

**Dimension 19 (Cross-Layer Analysis):**

Write four subsections:
```
### Cross-Layer API URL Consistency
[Matrix table of ALL frontend calls vs backend routes. Same table as Dimension 18.]
[State total mismatches found.]

### Cross-Layer Auth Contract
[Full prose: JWT payload shape from backend vs what frontend expects. Token storage mechanism (cookie vs localStorage). Logout behaviour — does it clear the right storage. Any bugs in auth flow.]

### Cross-Layer Data Contract
[Full prose: field name alignment between form → API call → backend validator → schema. Response shape alignment. Error format consistency.]

### Cross-Layer Environment & Configuration
[Full prose: base URL env var alignment, CORS origin configuration, API versioning consistency, production deployment requirements.]
```

---

### After All 19 Dimensions — Scoring Summary Table

Immediately after Dimension 19, write:

```
---

## Scoring Summary

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Security (Backend) | 0.XX | X.X | X.XXX |
| Security (Frontend) | 0.XX | X.X | X.XXX |
| Code Quality (Backend) | 0.XX | X.X | X.XXX |
| Code Quality (Frontend) | 0.XX | X.X | X.XXX |
| Database Review | 0.XX | X.X | X.XXX |
| Compliance (Backend) | 0.XX | X.X | X.XXX |
| Compliance (Frontend) | 0.XX | X.X | X.XXX |
| Performance (Backend) | 0.XX | X.X | X.XXX |
| Performance (Frontend) | 0.XX | X.X | X.XXX |
| Maintainability (Backend) | 0.XX | X.X | X.XXX |
| Maintainability (Frontend) | 0.XX | X.X | X.XXX |
| Sonar Compliance (Backend) | 0.XX | X.X | X.XXX |
| Sonar Compliance (Frontend) | 0.XX | X.X | X.XXX |
| Testing & QA (Backend) | 0.XX | X.X | X.XXX |
| Testing & QA (Frontend) | 0.XX | X.X | X.XXX |
| Implementation Issues (Backend) | 0.XX | X.X | X.XXX |
| Implementation Issues (Frontend) | 0.XX | X.X | X.XXX |
| UI Navigation Integrity | 0.XX | X.X | X.XXX |
| **Total** | **1.00** | | **X.XX** |

**Gate Rule Triggers:**
- [Each gate rule that fired and its effect]
```

---

### After Scoring Summary — Actionable Suggestions

```
---

## Actionable Suggestions

1. **[Title]** — [Full description of the fix: what file to change, what exact code change to make, and what the expected outcome is. Minimum 2 sentences.]
2. **[Title]** — [Description.]
... (8–10 suggestions total, ordered by impact — most critical first)
```

---

### SECTION 3 — COMPLETE JSON OUTPUT

Write `## SECTION 3 — COMPLETE JSON OUTPUT` then write the complete JSON object in a fenced code block tagged ` ```json `.

#### ⚠️ CRITICAL JSON POPULATION RULES

**Rule A — `issues` arrays must be fully populated.**
Every issue found in FRONTEND_RESULT and BACKEND_RESULT raw findings MUST appear as a JSON object. Translate every `- SEVERITY: X | CATEGORY: Y | FILE: Z | MESSAGE: W` line into:
```json
{
  "severity": "high",
  "category": "y",
  "file": "z",
  "message": "w — full message text, not truncated"
}
```
An empty `"issues": []` is ONLY valid if zero issues were genuinely found for that dimension.

**Rule B — Narrative string fields must be full prose, not one-liners.**
Every string field corresponding to a named narrative (`"findings"`, `"error_handling"`, `"query_optimization"`, `"schema_integrity"`, `"efficiency_metrics"`, `"scalability_patterns"`, `"code_clarity"`, `"technical_debt"`, `"documentation_quality"`, `"complexity_metrics"`, `"test_strategy"`, `"navigation_audit"`, `"route_coverage"`, `"api_url_consistency"`, `"summary"`) must contain the full prose content written in Section 2 — not a compressed summary. These are minimum 30–40 words each.

**Rule C — code_smells must be a fully populated array.**
Every smell identified in the sub-audits must be a string entry in the `"code_smells"` array. Do not leave it as `[]` unless genuinely zero smells were found.

**Rule D — broken_links, missing_routes, orphaned_pages, api_url_mismatches must be arrays of objects.**
Even if the result is "none found", represent it as `[]` — do not set to `null`.

The JSON schema:

```json
{
  "review_summary": {
    "overall_status": "pass|fail|review_required",
    "quality_score": 0.0,
    "frontend_score": 0.0,
    "backend_score": 0.0,
    "passed_at": "ISO-8601 timestamp",
    "recommendation": "pass|conditional_pass|fail"
  },
  "cross_layer_analysis": {
    "api_url_consistency": {
      "mismatches_found": 0,
      "issues": [
        {
          "severity": "high",
          "frontend_file": "src/api/auth.js",
          "frontend_call": "POST /api/user/register",
          "backend_file": "routes/auth.js",
          "backend_route": "POST /api/auth/signup",
          "message": "Path mismatch — frontend calls /api/user/register but backend defines /api/auth/signup"
        }
      ],
      "summary": "Full prose narrative on cross-layer API consistency — minimum 30 words"
    },
    "auth_contract_consistency": {
      "issues": [
        {
          "severity": "high",
          "description": "Full description of auth contract inconsistency"
        }
      ],
      "summary": "Full prose narrative on auth contract alignment — minimum 30 words"
    },
    "data_contract_consistency": {
      "issues": [],
      "summary": "Full prose narrative on data contract alignment — minimum 30 words"
    },
    "environment_consistency": {
      "issues": [],
      "summary": "Full prose narrative on environment config alignment — minimum 30 words"
    }
  },
  "frontend_review": {
    "overall_status": "pass|fail|review_required",
    "quality_score": 0.0,
    "reviewed_at": "ISO-8601 timestamp",
    "security": {
      "score": 0.0,
      "layer": "frontend",
      "issues": [
        {
          "severity": "high",
          "category": "token_storage",
          "file": "frontend/src/api/axios.js",
          "line": "9",
          "message": "Full issue description — minimum 2 sentences with remediation"
        }
      ],
      "findings": "Full prose paragraph on frontend security posture — minimum 40 words",
      "secure_storage_compliant": false,
      "xss_protected": false,
      "csp_configured": false,
      "token_expiry_handled": true,
      "secrets_in_env": false
    },
    "code_quality": {
      "score": 0.0,
      "layer": "frontend",
      "issues": [
        {
          "severity": "high",
          "category": "async_handling",
          "file": "frontend/src/pages/dashboard/Dashboard.jsx",
          "message": "Full issue description — minimum 2 sentences with remediation"
        }
      ],
      "error_handling": "Full prose paragraph on frontend error handling — minimum 30 words",
      "code_smells": [
        "Exact smell description — file:line reference",
        "Exact smell description — file:line reference"
      ]
    },
    "ui_navigation_integrity": {
      "score": 0.0,
      "layer": "frontend",
      "issues": [
        {
          "severity": "medium",
          "category": "missing_route",
          "file": "frontend/src/router/AppRouter.jsx",
          "link_target": "/the-path",
          "message": "Full issue description"
        }
      ],
      "broken_links": [],
      "missing_routes": [],
      "orphaned_pages": [],
      "api_url_mismatches": [],
      "navigation_audit": "Full prose paragraph on navigation integrity — minimum 40 words",
      "route_coverage": "Full prose paragraph on route completeness — minimum 40 words",
      "api_url_consistency": "Full prose paragraph on API URL alignment — minimum 40 words"
    },
    "performance_scalability": {
      "score": 0.0,
      "layer": "frontend",
      "issues": [
        {
          "severity": "medium",
          "category": "bundle_size",
          "file": "frontend/src/router/AppRouter.jsx",
          "message": "Full issue description"
        }
      ],
      "efficiency_metrics": "Full prose paragraph on frontend rendering and fetching efficiency — minimum 30 words",
      "scalability_patterns": "Full prose paragraph on frontend architectural scalability — minimum 30 words"
    },
    "compliance": {
      "score": 0.0,
      "layer": "frontend",
      "issues": [
        {
          "severity": "high",
          "category": "configuration_deployment",
          "file": "frontend/package.json",
          "message": "Full issue description"
        }
      ],
      "checklist": {
        "configuration_deployment": false,
        "api_design": true,
        "accessibility_wcag": false,
        "documentation": true,
        "browser_compatibility": true,
        "i18n_readiness": false
      }
    },
    "maintainability": {
      "score": 0.0,
      "layer": "frontend",
      "issues": [
        {
          "severity": "medium",
          "category": "separation_of_concerns",
          "file": "frontend/src/pages/dashboard/MyTodos.jsx",
          "message": "Full issue description"
        }
      ],
      "code_clarity": "Full prose paragraph on frontend naming and readability — minimum 30 words",
      "technical_debt": "Full prose paragraph on frontend technical debt indicators — minimum 30 words",
      "documentation_quality": "Full prose paragraph on frontend documentation completeness — minimum 30 words"
    },
    "sonar_compliance": {
      "score": 0.0,
      "layer": "frontend",
      "issues": [
        {
          "severity": "high",
          "category": "javascript:S108",
          "file": "frontend/src/pages/dashboard/Dashboard.jsx",
          "message": "Full issue description"
        }
      ],
      "duplication_percentage": 0.0,
      "complexity_metrics": "Full prose paragraph on frontend cyclomatic complexity — minimum 30 words",
      "sonar_counts": {
        "bugs": 0,
        "vulnerabilities": 0,
        "code_smells": 0,
        "security_hotspots": 0
      }
    },
    "testing_qa": {
      "score": 0.0,
      "layer": "frontend",
      "test_results": {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0
      },
      "coverage": 0.0,
      "coverage_trend": "stable",
      "issues": [
        {
          "severity": "critical",
          "category": "test_infrastructure",
          "file": "frontend/src/",
          "message": "Full issue description — minimum 2 sentences"
        }
      ],
      "test_strategy": "Full prose paragraph on frontend testing strategy and gaps — minimum 40 words"
    },
    "implementation_issues": {
      "layer": "frontend",
      "spec_deviations": [],
      "ai_generated_patterns": [],
      "incomplete_implementations": [],
      "cross_file_inconsistencies": [
        {
          "severity": "high",
          "files": ["frontend/src/hooks/useAuth.js"],
          "message": "Full description of inconsistency"
        }
      ],
      "summary": "Full prose paragraph on frontend AI output reliability — minimum 40 words"
    },
    "frontend_suggestions": [
      "Suggestion 1 — specific and actionable",
      "Suggestion 2"
    ],
    "frontend_recommendation": "pass|conditional_pass|fail"
  },
  "backend_review": {
    "overall_status": "pass|fail|review_required",
    "quality_score": 0.0,
    "reviewed_at": "ISO-8601 timestamp",
    "backend_api_map": [
      {
        "method": "POST",
        "path": "/api/auth/signup",
        "controller": "signup",
        "auth_required": false
      }
    ],
    "security": {
      "score": 0.0,
      "layer": "backend",
      "issues": [
        {
          "severity": "high",
          "category": "jwt_security",
          "file": "backend/src/utils/jwt.js",
          "line": "8",
          "message": "Full issue description — minimum 2 sentences with remediation"
        }
      ],
      "findings": "Full prose paragraph on backend security posture — minimum 40 words",
      "helmet_configured": false,
      "rate_limiting_on_auth": false,
      "bcrypt_salt_rounds_compliant": true,
      "jwt_expiry_set": true,
      "jwt_algorithms_specified": false,
      "input_validation_present": false,
      "password_excluded_from_responses": true,
      "unhandled_rejection_handler": false
    },
    "code_quality": {
      "score": 0.0,
      "layer": "backend",
      "issues": [
        {
          "severity": "high",
          "category": "error_handling",
          "file": "backend/src/controllers/auth.controller.js",
          "message": "Full issue description — minimum 2 sentences with remediation"
        }
      ],
      "error_handling": "Full prose paragraph on backend error handling — minimum 40 words",
      "code_smells": [
        "Exact smell description — file:line reference",
        "Exact smell description — file:line reference"
      ]
    },
    "database_review": {
      "score": 0.0,
      "layer": "backend",
      "issues": [
        {
          "severity": "critical",
          "category": "schema_integrity",
          "file": "backend/src/models/User.js",
          "line": "30",
          "message": "Full issue description — minimum 2 sentences with remediation"
        }
      ],
      "query_optimization": "Full prose paragraph on backend query efficiency — minimum 30 words",
      "schema_integrity": "Full prose paragraph on backend schema design quality — minimum 30 words"
    },
    "performance_scalability": {
      "score": 0.0,
      "layer": "backend",
      "issues": [
        {
          "severity": "high",
          "category": "database_performance",
          "file": "backend/src/controllers/todo.controller.js",
          "line": "28",
          "message": "Full issue description — minimum 2 sentences with remediation"
        }
      ],
      "efficiency_metrics": "Full prose paragraph on backend performance efficiency — minimum 30 words",
      "scalability_patterns": "Full prose paragraph on backend scalability architecture — minimum 30 words"
    },
    "compliance": {
      "score": 0.0,
      "layer": "backend",
      "issues": [
        {
          "severity": "medium",
          "category": "api_versioning",
          "file": "backend/src/app.js",
          "message": "Full issue description"
        }
      ],
      "checklist": {
        "configuration_deployment": true,
        "api_design": false,
        "accessibility_wcag": null,
        "documentation": false,
        "rest_conventions": false,
        "api_versioning": false,
        "response_consistency": true
      }
    },
    "maintainability": {
      "score": 0.0,
      "layer": "backend",
      "issues": [
        {
          "severity": "medium",
          "category": "separation_of_concerns",
          "file": "backend/src/controllers/",
          "message": "Full issue description"
        }
      ],
      "code_clarity": "Full prose paragraph on backend naming and structure clarity — minimum 30 words",
      "technical_debt": "Full prose paragraph on backend technical debt — minimum 30 words",
      "documentation_quality": "Full prose paragraph on backend documentation completeness — minimum 30 words"
    },
    "sonar_compliance": {
      "score": 0.0,
      "layer": "backend",
      "issues": [
        {
          "severity": "high",
          "category": "javascript:S5659",
          "file": "backend/src/utils/jwt.js",
          "line": "8",
          "message": "Full issue description"
        }
      ],
      "duplication_percentage": 0.0,
      "complexity_metrics": "Full prose paragraph on backend cyclomatic complexity — minimum 30 words",
      "sonar_counts": {
        "bugs": 0,
        "vulnerabilities": 0,
        "code_smells": 0,
        "security_hotspots": 0
      }
    },
    "testing_qa": {
      "score": 0.0,
      "layer": "backend",
      "test_results": {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0
      },
      "coverage": 0.0,
      "coverage_trend": "stable",
      "issues": [
        {
          "severity": "critical",
          "category": "test_infrastructure",
          "file": "backend/",
          "message": "Full issue description — minimum 2 sentences"
        }
      ],
      "test_strategy": "Full prose paragraph on backend testing strategy and gaps — minimum 40 words"
    },
    "implementation_issues": {
      "layer": "backend",
      "spec_deviations": [],
      "ai_generated_patterns": [],
      "incomplete_implementations": [
        {
          "severity": "medium",
          "file": "backend/server.js",
          "marker": "MISSING_HANDLER",
          "message": "Full description of what is incomplete"
        }
      ],
      "cross_file_inconsistencies": [],
      "summary": "Full prose paragraph on backend AI output reliability — minimum 40 words"
    },
    "backend_suggestions": [
      "Suggestion 1 — specific and actionable",
      "Suggestion 2"
    ],
    "backend_recommendation": "pass|conditional_pass|fail"
  },
  "master_suggestions": [
    "Top cross-layer recommendation 1 — specific, actionable, 1–2 sentences",
    "Top cross-layer recommendation 2",
    "Top cross-layer recommendation 3"
  ],
  "recommendation": "pass|conditional_pass|fail"
}
```

---

### Verification Checklist Before Writing

Before writing `audit.md`, confirm:

- [ ] Dimensions are interleaved by topic (Security Backend/Frontend, Code Quality Backend/Frontend, etc.) — NOT grouped
- [ ] Every dimension heading uses `## DIMENSION N — [NAME] — Score: X.X/10`
- [ ] Every issue line uses `[Severity: X] \`category\` — \`file\` line N — Full description`
- [ ] All named narrative fields are full prose paragraphs (not one-liners)
- [ ] Executive Summary is plain Markdown, NOT wrapped in a code block
- [ ] Dimension narrative sections are NOT wrapped in code blocks
- [ ] Scoring Summary table is present after Dimension 19
- [ ] Actionable Suggestions (8–10 items) are present after Scoring Summary
- [ ] Dimension 18 contains: broken links list, full route coverage table, full API URL mismatch table, 3 named narrative paragraphs
- [ ] Dimension 19 contains 4 subsections: API URL Consistency, Auth Contract, Data Contract, Environment
- [ ] All JSON `issues` arrays are fully populated (not `[]` unless genuinely zero issues)
- [ ] All JSON narrative string fields contain full prose (not one-liners)
- [ ] JSON `code_smells` arrays are fully populated
- [ ] No section is truncated or abbreviated

### Gate Rule

If any section of the output is incomplete at the time of writing, the file header status line must read:

```
# Status: INCOMPLETE AUDIT — MANUAL REVIEW REQUIRED
```

And a warning must be prepended to Section 1:

```
> ⚠️ WARNING: This audit report is incomplete. The following sections could not be fully generated.
> Sections affected: [list]
> Action required: Re-run the audit or complete the missing sections manually.
```

## BEHAVIOR INSTRUCTIONS

1. **Phases 1–4 produce NO output.** The only output is Phase 5 — the complete formatted report.
2. **Every `issues` array must have real objects.** Never leave `"issues": []` if sub-audit findings exist. The model's failure to populate issues arrays is the most common formatting failure — do not repeat it.
3. **Every narrative string field is full prose.** `"findings"`, `"error_handling"`, `"query_optimization"`, `"schema_integrity"`, `"efficiency_metrics"`, `"scalability_patterns"`, `"code_clarity"`, `"technical_debt"`, `"documentation_quality"`, `"complexity_metrics"`, `"test_strategy"`, `"summary"`, `"navigation_audit"`, `"route_coverage"`, `"api_url_consistency"`, and all `"summary"` fields in `cross_layer_analysis` must be full sentences (minimum 30 words). Never use comma-separated or semicolon-separated one-liners.
4. **Do not hallucinate.** Only analyze explicitly provided code.
5. **Score honestly.** 8+ only when genuinely well-implemented with no HIGH issues.
6. **Cross-layer analysis is the unique value** of this master prompt — invest full effort in Phase 3.
7. **The Scoring Summary table is mandatory.** All 18 scored dimensions must appear with their weights, scores, and weighted contributions.
8. **Actionable Suggestions must be 8–10 items** ordered by impact, each with minimum 2 sentences and specific file references.
