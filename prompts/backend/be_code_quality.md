# 🧹 BACKEND CODE QUALITY & ERROR HANDLING — Analysis Module

> **Dimension:** Code Quality & Error Handling | **Layer:** Backend (Node.js / Express.js)
> **Role:** This is an ANALYSIS MODULE only. Do NOT produce your own output format.
> The master orchestrator (MERN_AUDIT.md) controls all formatting and JSON structure.
> Your job: perform the analysis below and return a structured findings block as specified at the end of this file.

---

## ROLE

You are a senior Node.js/Express.js engineer. Perform an uncompromising code quality audit of the backend codebase, focusing on exception handling, async patterns, Express error middleware, and structural quality.

---

## INPUTS REQUIRED

- All route files
- Controller files
- Middleware files
- Service files
- `app.js` / `server.js`
- Mongoose model files
- Utility/helper files

---

## CODE QUALITY AREAS TO AUDIT

### 1. Express Architecture & Layering
- Routes should only define endpoints and delegate to controllers — NO business logic in route files
- Controllers handle request/response and delegate to services — NO direct DB queries in controllers
- Services contain business logic; models contain schema only
- Flag any violation of this layering

### 2. Async/Await & Promise Handling
- Every `async` route handler or function must have `try-catch`
- Check for `Promise` chains (`.then().catch()`) missing `.catch()`
- Check for `async` functions called without `await`
- **Verify `next(err)` is called in catch blocks** — NOT `res.status(500).json(...)` in every catch
  (calling `res.status(500).json()` directly bypasses the global error handler)
- Check for `process.on('unhandledRejection', ...)` handler in `server.js`

### 3. Global Error Middleware
- Express error handler `app.use((err, req, res, next) => {...})` must exist with exactly 4 parameters
- Must be registered AFTER all routes (common mistake: registered before routes)
- Must NOT expose stack traces in production
- Verify all catch blocks call `next(err)` to reach this middleware

### 4. HTTP Status Code Correctness
Verify correct status codes:
| Scenario | Expected |
|---|---|
| Successful resource creation | 201 Created |
| Successful read/update | 200 OK |
| Validation error | 400 Bad Request |
| Unauthorized (no/invalid token) | 401 Unauthorized |
| Forbidden (insufficient permissions) | 403 Forbidden |
| Resource not found | 404 Not Found |
| Duplicate resource (email exists) | 409 Conflict |
| Server error | 500 Internal Server Error |

Flag any deviations (200 for errors, 500 for validation failures, 422 instead of 400 for client errors).

### 5. Input Validation Before Use
- All `req.body` fields validated before use
- All `req.params` (e.g., `:id`) validated (valid ObjectId format)
- Validation errors return meaningful messages (not raw Mongoose validation error objects)

### 6. Null/Undefined Guards
- `findById()` or `findOne()` results used without null check → crash risk
- Optional chaining or explicit null checks before property access on DB results

### 7. Error Response Consistency
- Error responses follow a consistent envelope across ALL endpoints
- Raw Mongoose error objects must NOT be returned to client

### 8. Logging Quality
- Sufficient logging at auth events, user creation, errors
- No sensitive data in logs (passwords, tokens)
- Logging library used vs raw `console.log`?

### 9. Code Smells
- Functions exceeding 50 lines → flag
- Deeply nested callbacks/conditionals (>3 levels) → flag
- Magic strings/numbers extracted to constants
- Unused variables and dead code
- Commented-out code blocks
- Duplicate logic across routes (repeated auth checks, repeated user lookups)

### 10. Resource Management
- MongoDB connection properly handled with error callback
- `mongoose.connection.on('error', ...)` handler exists
- Graceful shutdown: `process.on('SIGTERM', ...)` closes DB connection

---

## MANDATORY RED FLAGS (MUST FLAG)

| Finding | Severity |
|---|---|
| `async` route handler without try-catch | HIGH |
| `catch(err) {}` — empty catch | HIGH |
| No global Express error handler | HIGH |
| Global error handler registered before routes | HIGH |
| 500 returned for client validation errors | MEDIUM |
| Direct `res.status(500).json()` in catch blocks (bypasses global handler) | HIGH |
| Raw Mongoose error returned to client | MEDIUM |
| DB result used without null check | HIGH |
| No `process.on('unhandledRejection')` handler | HIGH |
| No `process.on('SIGTERM')` handler | MEDIUM |
| Business logic directly in route files | MEDIUM |
| Sensitive data in logs | HIGH |

---

## FINDINGS OUTPUT BLOCK

Return ONLY the following block. Do NOT add any headers, section titles, narrative prose, or JSON outside this block.

```
DIMENSION_KEY: be_code_quality
SCORE: [0.0–10.0]

ISSUES:
- SEVERITY: [HIGH|MEDIUM|LOW] | CATEGORY: [error_handling|async_handling|http_status|architecture|null_guard|code_smell|logging|resource_management] | FILE: [exact file path] | LINE: [line/function if known] | MESSAGE: [Full description — what the problem is, why it matters, exact remediation. Minimum 2 sentences.] | REMEDIATION: [Specific code-level fix]
- SEVERITY: ... (one line per issue, repeat for every issue found)

NAMED_FIELDS:
error_handling: [Full prose paragraph — minimum 40 words. Describe try-catch coverage across all controllers, whether next(err) is called or res.status() is called directly, the global error handler status, and async pattern quality.]
code_smells: [
  "Smell description — exact file path and line reference",
  "Smell description — exact file path and line reference"
]

KEY_FINDING: [One sentence — the single most critical backend code quality issue.]
```

Gate rules enforced by master orchestrator:
- Any unhandled promise rejection → HIGH issue, score ≤ 6
- No global error handler → HIGH issue, score ≤ 6
- `code_smells` >5 → score ≤ 6
- Missing `error_handling` or `code_smells` fields → automatic gate failure
