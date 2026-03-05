# RBAC — Complete Review

**Purpose:** Single reference for the full RBAC production-readiness review, aligning **RBAC_Prompt_Mongoose_V6.md**, **MERN_AUDIT.md**, and **RBAC_Production_Readiness_Gap_Analysis.md**.

---

## 1. Document Roles

| Document | Role |
|----------|------|
| **RBAC_Prompt_Mongoose_V6.md** | Implementation spec: data models, APIs, security, tests, checklist. Updated to include search escaping, .lean(), seed NODE_ENV, coverage threshold, and gap-analysis alignment. |
| **MERN_AUDIT.md** | Audit orchestrator: runs Frontend_Review and Backend_Review, cross-layer analysis, scoring. Updated with **Phase 3E — RBAC Production Readiness** and Dimension 5 (Database) RBAC-specific checks. |
| **RBAC_Production_Readiness_Gap_Analysis.md** | Gap analysis: maps prompt + audit to codebase gaps, fix order, and checklist. Authoritative checklist for implementers and auditors. |

---

## 2. Updates Applied (per Gap Analysis)

### 2.1 RBAC_Prompt_Mongoose_V6.md

- **Section 7 (Service layer):** Added **Search parameter escaping** requirement: escape `search` with `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` before `$regex` in listRoles/listPermissions; reference to gap analysis.
- **Section 7:** Clarified **.lean()** for list queries; note that listRoles may use aggregation for permission count when using .lean().
- **Section 9 (Seeder):** Added **Production safety**: seed-runner MUST check NODE_ENV and exit in production; reference to gap analysis.
- **Section 12 (Security):** Added **Search regex escaping** under Query safety, with reference to Section 7.
- **Section 15 (Unit tests):** Clarified that backend must enforce **coverageThreshold for src/rbac/**; reference to gap analysis.
- **SINGLE-RUN CHECKLIST:** Added:
  - Backend listRoles/listPermissions escape search before $regex.
  - RBAC seed-runner checks NODE_ENV in production.
  - Backend Jest coverageThreshold for src/rbac/**.
- **New closing section:** **ALIGNMENT WITH MERN_AUDIT & GAP ANALYSIS** — references gap analysis and Phase 3E for implementers and auditors.

### 2.2 MERN_AUDIT.md

- **Phase 3E — RBAC Production Readiness (when RBAC module present):** Six checks:
  1. Search regex escaping in listRoles/listPermissions (HIGH if missing).
  2. .lean() on list queries (MEDIUM if missing).
  3. Seed-runner NODE_ENV check (MEDIUM if missing).
  4. Shared getApiErrorMessage in RBAC admin catch blocks (MEDIUM if missing).
  5. RBAC test coverage threshold (backend) and RBAC tests (frontend) (MEDIUM if missing).
  6. API_PREFIX and NEXT_PUBLIC_API_URL documented (LOW if missing).
- **Dimension 5 (Database):** `query_optimization` and `schema_integrity` narratives must explicitly assess RBAC when present: .lean() on listRoles/listPermissions, search escaping, seed-runner NODE_ENV.
- **Executive Summary — Gate Rule Triggers:** When RBAC is present, list Phase 3E failures; reference gap analysis.

---

## 3. Complete Verification Checklist

Use this checklist for a full RBAC production-readiness pass. Each item should be verified in code or docs.

### Security (A05 / Prompt §7, §12)

- [ ] **Search escaping:** In `backend/src/rbac/rbac.service.ts`, `listRoles` and `listPermissions` escape the `search` parameter before using it in `$regex` (e.g. `search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`).
- [ ] **No raw user input in $regex:** No other RBAC endpoints use unescaped user input in MongoDB `$regex`.

### Query optimization (Audit DB 9–10 / Prompt §7)

- [ ] **listPermissions:** Uses `.lean()` on the find query for the list (read-only).
- [ ] **listRoles:** Uses `.lean()` where possible; if permission count is needed, uses aggregation or separate count, not full populate on list.

### Frontend code quality (Audit 9–10 / Prompt §14)

- [ ] **getApiErrorMessage:** File `frontend/src/lib/getApiError.ts` (or equivalent) exists and exports a function that returns a user-facing message (and optionally status) from an API error.
- [ ] **RBAC admin catch blocks:** All of roles, permissions, users, settings pages use this helper (or equivalent) for 403 / 401 / generic messages.

### Seeder safety (Audit Database / Prompt §9)

- [ ] **Seed-runner NODE_ENV:** The script that invokes `seedRbac()` (e.g. `backend/src/rbac/seed-runner.ts`) checks `NODE_ENV === 'production'` and exits with an error (or refuses to run).

### Testing & coverage (Audit 9–10 / Prompt §15)

- [ ] **Backend RBAC tests:** `npm test` (or `jest src/rbac`) runs and passes.
- [ ] **Backend coverage threshold:** Jest config (or package.json) sets `coverageThreshold` for paths matching `src/rbac/**` (e.g. 90% lines/branches/functions/statements).
- [ ] **Frontend RBAC tests:** `npm test` with RBAC tests runs and passes.
- [ ] **Frontend RBAC coverage:** Threshold for `src/rbac/**` is at least 80% (or 90% if targeting strict 9–10).

### Documentation & compliance (Prompt checklist)

- [ ] **API_PREFIX:** Documented in backend README or `.env.example`.
- [ ] **NEXT_PUBLIC_API_URL:** Documented in frontend README or `.env.local.example`; root README may briefly state both for RBAC.

### Rate limiting (Prompt §12)

- [ ] **RBAC routes:** Either covered by global ThrottlerGuard (documented) or have RBAC-specific limits (e.g. 100/15min read, 30/15min write).

---

## 4. How to Run the Complete Review

1. **Implementers:**  
   - Implement or fix items in **RBAC_Production_Readiness_Gap_Analysis.md** in the recommended order.  
   - Confirm every item in **RBAC_Prompt_Mongoose_V6.md** “SINGLE-RUN CHECKLIST” and in **Section 3** above.

2. **Auditors:**  
   - Run **MERN_AUDIT.md** (execute Frontend_Review.md and Backend_Review.md, then Phases 3–5).  
   - When RBAC is present, complete **Phase 3E — RBAC Production Readiness** and record results in the Executive Summary and in Dimension 5 (Database).  
   - Use **RBAC_Production_Readiness_Gap_Analysis.md** as the authoritative checklist for RBAC-specific findings.

3. **Gate:**  
   - No CRITICAL/HIGH from Phase 3E (e.g. search escaping must be present).  
   - Overall status and score from MERN_AUDIT (e.g. ≥ 7.5, no CRITICAL/HIGH for “pass”).

---

## 5. References

- **RBAC spec:** `prompts/RBAC_Prompt_Mongoose_V6.md`
- **Audit orchestrator:** `prompts/MERN_AUDIT.md`
- **Gap analysis:** `prompts/RBAC_Production_Readiness_Gap_Analysis.md`
- **Existing audit report:** `audit.md` (output of MERN_AUDIT; may need re-run after RBAC fixes)
