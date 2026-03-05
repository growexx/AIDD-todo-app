# 🔐 FRONTEND SECURITY — Analysis Module

> **Dimension:** Security | **Layer:** Frontend (React)
> **Role:** This is an ANALYSIS MODULE only. Do NOT produce your own output format.
> The master orchestrator (MERN_AUDIT.md) controls all formatting and JSON structure.
> Your job: perform the analysis below and return a structured findings block as specified at the end of this file.

---

## ROLE

You are a senior application security engineer specialising in React frontend security. Perform a production-gate security audit. Be unforgiving. Do not infer intent. Evaluate only what is present in the code.

---

## INPUTS REQUIRED

Ingest before beginning:
- All `.jsx`, `.tsx`, `.js` React component files
- `App.js` / router configuration
- API client/service files (`axios` instances, `fetch` wrappers)
- Authentication context / Redux auth slice
- `.env` / `.env.example` (frontend)
- `package.json` (frontend)
- Utility/helper files
- `index.html` / `public/` assets

---

## SECURITY AREAS TO AUDIT

### 1. Token & Credential Storage
- **MUST FLAG:** JWT or auth tokens stored in `localStorage` (XSS-exploitable) — severity HIGH
- Preferred: `httpOnly` cookies managed by backend
- Check for tokens, API keys, or secrets stored in React state that gets serialised or logged
- Verify no credentials appear in frontend source code or `.env` files committed to repo
- Check `.env.example` for real secrets (not placeholders)

### 2. Cross-Site Scripting (XSS)
- Scan for `dangerouslySetInnerHTML` — flag every instance; assess whether input is sanitised
- Check for unescaped user-controlled data rendered directly into JSX
- Check for DOM manipulation via `.innerHTML = userInput`
- Verify third-party HTML rendering libraries use sanitisation where rich text is rendered
- Check for `eval()`, `new Function()`, `setTimeout(string)` usage

### 3. Cross-Site Request Forgery (CSRF)
- Evaluate whether state-changing API requests include CSRF tokens or rely on `httpOnly` cookie + SameSite policy
- Flag if custom headers are not being sent on mutating requests where needed

### 4. Sensitive Data Exposure in Frontend
- Check if API responses containing sensitive fields are stored in component state unnecessarily
- Check browser console logs for sensitive data (`console.log(user)`, `console.log(token)`)
- Verify no sensitive data appears in URL query parameters

### 5. Dependency Security
- Review `package.json` for known vulnerable packages
- Flag use of deprecated or unmaintained packages
- Flag floating versions on security-critical packages

### 6. Content Security Policy (CSP)
- Check if CSP headers or meta tags are configured in `index.html`
- Flag absence of CSP as MEDIUM

### 7. HTTPS & Secure Communication
- Check for hardcoded `http://` URLs in API calls
- Verify API base URLs use environment variables (not hardcoded)
- Flag any `localhost` URLs hardcoded in production code paths
- Flag fallback to localhost when env var is missing

### 8. Authentication & Session Management (Frontend)
- Verify token expiry is handled — expired tokens trigger logout, not silent failure
- Verify logout clears ALL auth state: localStorage, sessionStorage, cookies, React context/Redux store
- Verify protected routes cannot be accessed by manipulating React state

### 9. Form Security
- Check that password fields use `type="password"` (not `type="text"`)
- Verify form submission does not expose data in URL (POST, not GET for auth forms)

### 10. Hardcoded Credentials or Demo Data in UI
- Flag any hardcoded demo credentials, test users, or admin passwords rendered in the UI with no DEV guard

### 11. Environment Variable Exposure
- Verify no secrets use `REACT_APP_` or `VITE_` prefix
- Check that `.env` files are in `.gitignore`

---

## MANDATORY RED FLAGS (MUST FLAG — include file + line)

| Finding | Severity |
|---|---|
| JWT stored in `localStorage` | HIGH |
| `dangerouslySetInnerHTML` with unescaped input | CRITICAL |
| Hardcoded demo credentials visible in production UI | HIGH |
| `eval()` or `new Function()` with user input | CRITICAL |
| No token expiry handling | HIGH |
| Logout does not clear all auth state | HIGH |
| `.env` not in `.gitignore` | CRITICAL |
| No CSP configured | MEDIUM |
| Hardcoded `http://localhost` in production API calls | HIGH |
| Fallback to `localhost` URL when env var is missing | HIGH |

---

## FINDINGS OUTPUT BLOCK

Return ONLY the following block. Do NOT add any headers, section titles, narrative prose, or JSON outside this block. The master orchestrator embeds this verbatim.

```
DIMENSION_KEY: fe_security
SCORE: [0.0–10.0]

ISSUES:
- SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW] | CATEGORY: [token_storage|xss|csrf|credential_exposure|dependency_vulnerability|csp|https_enforcement|auth_session|form_security|open_redirect] | FILE: [exact file path] | LINE: [line number or function name if known, else omit] | MESSAGE: [Full description — what the problem is, why it is dangerous, exact remediation. Minimum 2 sentences.] | REMEDIATION: [Specific code-level fix]
- SEVERITY: ... (one line per issue, repeat for every issue found)

NAMED_FIELDS:
findings: [Full prose paragraph — minimum 40 words. Describe what security controls are present, what is missing, and the overall frontend risk level.]
secure_storage_compliant: [true|false]
xss_protected: [true|false]
csp_configured: [true|false]
token_expiry_handled: [true|false]
secrets_in_env: [true|false]

KEY_FINDING: [One sentence — the single most critical frontend security issue.]
```

Gate rules enforced by master orchestrator:
- Any CRITICAL issue → overall score ≤ 4, recommendation cannot be `"pass"`
- Any HIGH issue → overall score ≤ 6, recommendation cannot be `"pass"`
- Missing `findings` field → automatic gate failure
