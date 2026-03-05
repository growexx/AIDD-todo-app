# ⚡ BACKEND PERFORMANCE & SCALABILITY — Analysis Module

> **Dimension:** Performance & Scalability | **Layer:** Backend (Node.js / Express.js)
> **Role:** This is an ANALYSIS MODULE only. Do NOT produce your own output format.
> The master orchestrator (MERN_AUDIT.md) controls all formatting and JSON structure.
> Your job: perform the analysis below and return a structured findings block as specified at the end of this file.

---

## ROLE

You are a senior Node.js performance and scalability engineer. Audit the backend for event loop blocking, query efficiency, compression, and horizontal scaling readiness.

---

## INPUTS REQUIRED

- `app.js` / `server.js`
- All controller files
- Database connection config
- `package.json`
- Route files

---

## PERFORMANCE AREAS TO AUDIT

### 1. Event Loop Blocking (CRITICAL)
- `fs.readFileSync`, `crypto.pbkdf2Sync`, `JSON.parse` on large payloads synchronously
- CPU-intensive operations without worker threads
- Synchronous hashing (bcryptjs `hashSync` in a hot path)
- Large `for` loops in request handlers

### 2. Database Performance
- Unbounded queries: `Model.find()` with no `.limit()` on large collections — HIGH
- Missing pagination on list endpoints
- N+1 patterns (flagged in be_database_review but note performance impact here)
- Missing text indexes on search fields (`$regex` without index is O(n))
- No `.lean()` on read-heavy queries

### 3. HTTP Response Size
- Response compression: `compression` middleware installed and applied before routes?
- Unnecessarily large payloads (returning all fields when only a few are needed)
- Payload size limit on `express.json()` — is it set appropriately?

### 4. Connection & Resource Pooling
- `mongoose.connect()` with `maxPoolSize` — default is 5, too low for production load
- No connection pool metrics/monitoring

### 5. Caching
- No caching for frequently-read data (e.g., user profile on every authenticated request)
- Missing `Cache-Control` headers on responses
- In-memory cache vs. external cache (Redis) for stateful data

### 6. Rate Limiting at Scale
- `express-rate-limit` with default in-memory store will NOT share state across multiple Node.js instances
- In-process session stores will break horizontal scaling

### 7. Async Pattern Efficiency
- Parallel async operations should use `Promise.all()` not sequential `await await await`
- Check for sequential database queries that could be parallelized

---

## MANDATORY RED FLAGS (MUST FLAG)

| Finding | Severity |
|---|---|
| Synchronous blocking call in request handler | CRITICAL |
| Unbounded `find()` — no `.limit()` on list endpoint | HIGH |
| No compression middleware | MEDIUM |
| N+1 query pattern (performance impact) | HIGH |
| In-memory rate limit store (breaks multi-instance) | MEDIUM |
| Sequential `await` where `Promise.all` could parallelize | MEDIUM |
| No `maxPoolSize` on mongoose connection | LOW |
| `$regex` text search without text index | MEDIUM |

---

## FINDINGS OUTPUT BLOCK

Return ONLY the following block. Do NOT add any headers, section titles, narrative prose, or JSON outside this block.

```
DIMENSION_KEY: be_performance_scalability
SCORE: [0.0–10.0]

ISSUES:
- SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW] | CATEGORY: [event_loop_blocking|database_performance|response_compression|connection_pooling|caching|rate_limiting|async_efficiency] | FILE: [exact file path] | LINE: [line/function if known] | MESSAGE: [Full description — what the problem is, the performance impact, and exact remediation. Minimum 2 sentences.] | REMEDIATION: [Specific code-level fix]
- SEVERITY: ... (one line per issue, repeat for every issue found)

NAMED_FIELDS:
efficiency_metrics: [Full prose paragraph — minimum 30 words. Describe event loop blocking risks, payload sizes, compression status, async patterns, and the main inefficiencies found.]
scalability_patterns: [Full prose paragraph — minimum 30 words. Describe stateless design, rate limiter store type, horizontal scaling readiness, session management approach, and any single-instance assumptions.]

KEY_FINDING: [One sentence — the single most critical backend performance issue.]
```

Gate rules enforced by master orchestrator:
- Synchronous blocking in request handler → CRITICAL
- Unbounded find → HIGH
- Missing `efficiency_metrics` or `scalability_patterns` → automatic gate failure
