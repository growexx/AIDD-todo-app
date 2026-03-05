IMPLEMENTATION PROMPT: ROLE-BASED ACCESS CONTROL (RBAC) MODULE
==============================================================

Purpose: Reusable implementation specification for adding a complete, production-ready
RBAC module to any Node/Express/Mongoose + React/Redux application. This module manages
roles, permissions, user–role assignments, and authorization middleware. It is fully
independent from authentication — it consumes req.user.id only and does not implement
login, JWT issuing, or password logic.

═══════════════════════════════════════════════
1. CONTEXT AND SCOPE
═══════════════════════════════════════════════

- Integrate RBAC into the EXISTING application as a plug-and-play module under
  backend/src/rbac/ (NestJS) and frontend/src/rbac/ (Next.js/React).
- Project layout: repository root contains backend/ (NestJS + Mongoose) and frontend/
  (Next.js App Router). Backend uses TypeScript (.ts); frontend uses TypeScript (.tsx/.ts).
- Target stack: Node (NestJS/Express), MongoDB, Mongoose, React (Next.js; context or Redux), JWT.
- Add the following capabilities not currently present:
  - Role management: create, read, update, delete roles.
  - Permission registry: predefined permission codes seeded into the DB.
  - Role–Permission mapping: assign and remove permissions from roles.
  - User–Role mapping: assign and remove roles from users by userId string.
  - Permission aggregation: collect all permissions from all of a user's roles.
  - Authorization middleware: authorize(permission) using aggregated permissions only.
  - Optional Redis permission caching: off by default, enabled via REDIS_URL env var.
  - Default role back-fill: during seeding, assign the default user role to ALL existing
    users who do not already have any role assigned in the UserRole collection.
  - RBAC Admin UI: a fully functional React admin panel (under frontend/src/app/rbac-admin/
    for Next.js App Router) for managing roles, permissions, user–role assignments, and
    triggering back-fill.
    All UI actions are gated by PermissionGate — only users with the required permission
    can see and use each panel. No role-name checks in UI logic.
  - Unit tests: full test suite targeting ≥90% code coverage across the backend RBAC
    module (service, guards, registry, seeder, controller) and frontend permission layer
    (hooks, provider, gate, context or Redux). Tests are runnable with npm test in backend/
    and npm test in frontend/ (if test script is configured) independently.
- Configurable via environment or placeholders:
  - {{api_prefix}} — base prefix for RBAC routes (e.g. /api/rbac).
  - {{default_admin_role}} — name of the seeded super-admin role (e.g. super-admin).
  - {{default_user_role}} — name of the default role assigned to existing users (e.g. user).
  - {{cache_ttl_seconds}} — Redis cache TTL in seconds (e.g. 300).

═══════════════════════════════════════════════
2. DATA MODEL CHANGES (MONGOOSE SCHEMAS)
═══════════════════════════════════════════════

Do NOT define a User schema inside the RBAC module. Assume User lives in the existing
auth module. Use userId as a plain String (the existing user's _id as a string).

--- Role Schema (backend/src/rbac/schemas/role.schema.ts) ---

Fields:
- name: String, required, unique, trimmed. The role identifier (e.g. 'admin', 'editor').
- description: String, optional. Human-readable description of the role.
- isDefault: Boolean, default false. When true, this role is the default role assigned
  to all existing users during seeding and to new users via the back-fill mechanism.
  Only one role should have isDefault: true at any time; enforce this in the service
  (when setting a role as default, unset isDefault on any previously default role).
- permissions: Array of ObjectId, ref: 'Permission'. Populated on read. Start empty.
- createdAt: Date, auto (timestamps: true).
- updatedAt: Date, auto (timestamps: true).

Indexes:
- Use @Prop({ unique: true }) for name; do NOT add a separate schema.index({ name: 1 }) — Mongoose creates the unique index automatically. Duplicate index definitions cause Mongoose warnings.
- { isDefault: 1 } sparse index (for fast lookup of the current default role).

Virtuals / options:
- toJSON: { virtuals: true } so _id is exposed as id in responses.

--- Permission Schema (backend/src/rbac/schemas/permission.schema.ts) ---

Fields:
- code: String, required, unique, trimmed. Format: module:action (e.g. role:create)
  or wildcard *:* or module:* (e.g. role:*). Must match regex:
  /^(\*:\*|[a-z][a-z0-9_-]*:\*|[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*)$/
- description: String, optional. Human-readable description.
- createdAt: Date, auto.
- updatedAt: Date, auto.

Indexes:
- Use @Prop({ unique: true }) for code; do NOT add a separate schema.index({ code: 1 }) — Mongoose creates the unique index automatically. Do not define a separate unique index on a field that already has @Prop({ unique: true }).

Virtuals:
- toJSON: { virtuals: true }

--- UserRole Schema (backend/src/rbac/schemas/user-role.schema.ts) ---

Purpose: Maps userId strings to role ObjectIds. Separate from the User model so the
RBAC module stays independent.

Fields:
- userId: String, required. The external user's _id (as string).
- roleId: ObjectId, ref: 'Role', required.
- assignedAt: Date, default: Date.now.
- isBackfilled: Boolean, default false. Set to true when this assignment was created
  automatically by the seeder back-fill (not manually by an admin). Useful for auditing
  and for distinguishing auto-assigned roles from deliberately assigned ones.

Indexes:
- { userId: 1, roleId: 1 } unique compound index (prevents duplicates).
- { userId: 1 } for fast lookup of all roles for a user.
- { isBackfilled: 1 } sparse index (for auditing back-filled assignments).

On role deletion: remove all UserRole documents where roleId matches the deleted role
(via a pre('remove') or post('findOneAndDelete') hook on the Role schema, or explicitly
in the service deleteRole method using UserRole.deleteMany({ roleId })).

═══════════════════════════════════════════════
3. PERMISSION REGISTRY (backend/src/rbac/rbac.registry.ts)
═══════════════════════════════════════════════

The registry is the single source of truth for all permission codes in the system.
All codes must be defined here and seeded from here. Never hardcode permission strings
anywhere other than this file and the routes that use them.

Permission format rules:
- Standard: module:action (e.g. role:create, user:delete, report:view).
- Module wildcard: module:* (e.g. role:* means all role actions).
- Global wildcard: *:* (matches all permissions — for super-admin only).
- Regex: /^(\*:\*|[a-z][a-z0-9_-]*:\*|[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*)$/
- Modules and actions: lowercase letters, digits, hyphens, underscores only.

Required permission codes (generic, domain-agnostic — reusable in any project):

  // Role management (admin-level)
  ROLE_CREATE:              'role:create'
  ROLE_VIEW:                'role:view'
  ROLE_UPDATE:              'role:update'
  ROLE_DELETE:              'role:delete'

  // Permission management (admin-level)
  PERMISSION_VIEW:          'permission:view'
  PERMISSION_MANAGE:        'permission:manage'

  // User–Role assignment (admin-level)
  ROLE_ASSIGN:              'role:assign'
  ROLE_REVOKE:              'role:revoke'

  // User management (create/invite users — super-admin and admin)
  USER_CREATE:              'user:create'
  USER_VIEW:                'user:view'
  USER_UPDATE:              'user:update'
  USER_DELETE:              'user:delete'

  // Admin-user management (create/manage admin accounts — super-admin only)
  ADMIN_CREATE:             'admin:create'
  ADMIN_VIEW:               'admin:view'
  ADMIN_UPDATE:             'admin:update'
  ADMIN_DELETE:             'admin:delete'

  // Task management
  TASK_CREATE:              'task:create'
  TASK_VIEW:                'task:view'
  TASK_UPDATE:              'task:update'
  TASK_DELETE:              'task:delete'
  TASK_UPDATE_STATUS:       'task:update-status'  // manager-level: status-only updates

  // Own-resource access (regular users — their own data only)
  OWN_PROFILE_VIEW:         'own:profile-view'
  OWN_PROFILE_UPDATE:       'own:profile-update'
  OWN_TASK_VIEW:            'own:task-view'
  OWN_TASK_CREATE:          'own:task-create'
  OWN_TASK_UPDATE:          'own:task-update'

  // User permissions (read)
  USER_VIEW_PERMISSIONS:    'user:view-permissions'

  // Wildcards (for seeding only)
  GLOBAL_WILDCARD:          '*:*'

Exports:
- PERMISSIONS object (all codes above as const).
- getAllPermissionCodes(): returns all standard (non-wildcard) codes as an array.
- getAllPermissionCodesWithWildcards(): returns all codes including *:*.
- isValidPermissionCode(code): returns boolean; validates against the regex.

Adding project-specific permissions: Create a separate registry file in the consuming
project (e.g. backend/src/todos/task.permissions.ts) and call the seeder with the combined
list. Document this pattern in the README.

═══════════════════════════════════════════════
4. BACKEND API BEHAVIOR
═══════════════════════════════════════════════

All routes are mounted under {{api_prefix}} (e.g. /api/rbac).
All routes require the external auth middleware to have set req.user = { id: string }
before entering any RBAC route. RBAC middleware does NOT issue or verify JWTs.

Every route response follows these envelopes:

  Success (2xx):
    { "data": <payload>, "meta": { "page", "limit", "total" } }  // meta only on lists
    { "data": <payload> }                                         // single items

  Error (4xx / 5xx):
    { "error": { "code": "<SCREAMING_SNAKE_CASE>", "message": "<human>", "details"?: {} } }

Standard error codes:
  VALIDATION_ERROR          400  — express-validator failures
  INVALID_PERMISSION_FORMAT 400  — permission code fails regex
  UNAUTHENTICATED           401  — req.user or req.user.id missing
  PERMISSION_DENIED         403  — authenticated but lacks required permission
  NOT_FOUND                 404  — resource does not exist
  CONFLICT                  409  — duplicate name, already assigned, etc.
  INTERNAL_ERROR            500  — unhandled server error

Use a shared response format (NestJS: interceptors or standard DTOs). Success: { data, meta? };
  error: { error: { code, message, details? } }. Backend must use a global response interceptor
  (e.g. backend/src/common/interceptors/response.interceptor.ts) that wraps every success response
  as { success: true, data: <controller return>, timestamp }. List endpoints return controller body
  { data: T[], meta: { page, limit, total } }, so the final response body is
  { success: true, data: { data: T[], meta }, timestamp }. No raw res.json() in controllers.

--- ROLES ---

POST {{api_prefix}}/roles                   [requires: role:create]
  Body: { name: string (required), description?: string }
  Validate: name non-empty, trimmed, no special characters.
  201 + role object on success.
  400 VALIDATION_ERROR if name missing or invalid.
  409 CONFLICT if role name already exists.

GET {{api_prefix}}/roles                    [requires: role:view]
  Query: page (default 1), limit (default 20, max 100), search (optional, matches name).
  200 + { data: Role[], meta: { page, limit, total } }.

GET {{api_prefix}}/roles/:id               [requires: role:view]
  Populate permissions array.
  200 + role with permissions.
  404 NOT_FOUND if role does not exist.

PATCH {{api_prefix}}/roles/:id             [requires: role:update]
  Body: { name?: string, description?: string, isDefault?: boolean } — all fields optional (partial update).
  If isDefault is set to true: unset isDefault on any currently default role first,
  then set isDefault: true on this role. Only one role may be default at a time.
  200 + updated role.
  400 VALIDATION_ERROR if provided values are invalid.
  404 NOT_FOUND if role does not exist.
  409 CONFLICT if new name is already taken.

DELETE {{api_prefix}}/roles/:id            [requires: role:delete]
  Delete the role. Remove all UserRole documents referencing this roleId.
  204 on success.
  404 NOT_FOUND if role does not exist.

--- ROLE–PERMISSIONS ---

POST {{api_prefix}}/roles/:id/permissions  [requires: permission:manage]
  Body: { permissionCode: string }
  Validate permissionCode against regex. Find the Permission document by code.
  Add permission ObjectId to role.permissions array if not already present (idempotent).
  200 + updated role on success (whether newly added or already present).
  400 INVALID_PERMISSION_FORMAT if code fails regex.
  404 NOT_FOUND if role or permission not found.

DELETE {{api_prefix}}/roles/:id/permissions/:permissionId  [requires: permission:manage]
  Remove permissionId from role.permissions array.
  204 on success.
  404 NOT_FOUND if role or link not found.

--- PERMISSIONS ---

GET {{api_prefix}}/permissions             [requires: permission:view]
  Query: page (default 1), limit (default 20, max 100), search (optional, matches code).
  200 + { data: Permission[], meta: { page, limit, total } }.

--- USER–ROLES ---

POST {{api_prefix}}/users/:id/roles        [requires: role:assign]
  Body: { roleId: string } or { roleName: string } — support both; prefer roleId.
  Validate userId non-empty string. Validate role exists.
  If RbacConfig.userExistsValidator is provided, call it; return 404 if false.
  Upsert UserRole document (idempotent — already assigned returns 200).
  200 or 201 on success.
  400 VALIDATION_ERROR if body missing or invalid.
  404 NOT_FOUND if role not found (or user, if validator present).

DELETE {{api_prefix}}/users/:id/roles/:roleId  [requires: role:revoke]
  Delete UserRole document for { userId: id, roleId }.
  204 on success.
  404 NOT_FOUND if the user–role link does not exist.

GET {{api_prefix}}/users/:id/roles         [requires: role:view]
  Return all roles assigned to the user (populated with permissions).
  200 + { data: Role[] }.

--- USER PERMISSIONS ---

GET {{api_prefix}}/users/:id/permissions   [requires: user:view-permissions]
  Aggregate all permissions from all of the user's roles.
  Deduplicate. Return as an array of permission code strings.
  200 + { userId: string, permissions: string[] }.
  400 VALIDATION_ERROR if userId param is empty.
  404 NOT_FOUND only if userExistsValidator is set and returns false.

--- DEFAULT ROLE BACK-FILL (Admin API) ---

POST {{api_prefix}}/admin/backfill-default-role   [requires: role:assign]
  Purpose: on-demand API equivalent of the seeder back-fill step. Assigns the current
  default role (isDefault: true) to all users who have no role in UserRole.
  Requires the RbacConfig.userModel to be set; returns 501 NOT_IMPLEMENTED if not.
  Body: { batchSize?: number } — optional, default 100, max 500.
  Response: 200 + { data: { processed: number, backfilled: number, skipped: number } }.
  400 VALIDATION_ERROR if batchSize is out of range.
  404 NOT_FOUND if no role with isDefault: true exists.
  501 NOT_IMPLEMENTED if userModel is not injected in RbacConfig.
  This endpoint is idempotent — safe to call multiple times.

═══════════════════════════════════════════════
5. MIDDLEWARE / GUARDS (NestJS: backend/src/rbac/guards/)
═══════════════════════════════════════════════

In NestJS, use guards and interceptors instead of Express middleware. Equivalent behavior:

PermissionsAttachmentGuard (guards/permissions-attachment.guard.ts)
  - Fetches the current user's aggregated permissions via the permission fetcher (e.g. RbacService).
  - Attaches result to request scope (e.g. req.permissions or a custom decorator) for the request.
  - Returns 401 UNAUTHENTICATED if req.user or req.user.id is missing.
  - On any DB or fetch error: log the error and return 500 INTERNAL_ERROR.
  - Result is cached for the request — do not fetch again.

RequirePermissionGuard (guards/require-permission.guard.ts) + @RequirePermission() decorator
  - Must run AFTER permissions are attached.
  - Reads attached permissions (never queries DB itself).
  - Returns 401 UNAUTHENTICATED if req.user or req.user.id is missing.
  - Returns 403 PERMISSION_DENIED if the permission is absent.
    Include { requiredPermission } in the error details field.
  - Uses wildcard matching algorithm (see section 6) — never checks role names.

Usage pattern in controller:
  @Post('roles')
  @UseGuards(JwtAuthGuard, PermissionsAttachmentGuard, RequirePermissionGuard)
  @RequirePermission('role:create')
  createRole(@Body() dto: CreateRoleDto) { ... }

═══════════════════════════════════════════════
6. WILDCARD MATCHING ALGORITHM
═══════════════════════════════════════════════

This algorithm must be implemented identically in:
- Backend: backend/src/rbac/guards/ or utils/wildcard.matcher.ts (used by RequirePermissionGuard)
- React: hasPermission() inside PermissionProvider (frontend/src/rbac/)
- Flutter: hasPermission() inside PermissionService

Function signature: matchesPermission(userPermissions: string[], required: string): boolean

Steps (apply in order, stop at first match):
  1. If userPermissions includes '*:*'           → return true  (global wildcard)
  2. If userPermissions includes required exactly → return true  (exact match)
  3. Parse required as 'module:action'.
     If userPermissions includes 'module:*'      → return true  (module wildcard)
  4. return false

Notes:
- *:* is stored as a real Permission document in MongoDB. It is exempt from format
  validation when it is the code being seeded or assigned; the regex allows it explicitly.
- module:* is also a storable permission code and also exempt from the action-part
  lowercase requirement in a relaxed sense — the regex covers it explicitly.
- Never check role names at any point in this algorithm or anywhere in authorization.

═══════════════════════════════════════════════
7. RBAC SERVICE (backend/src/rbac/rbac.service.ts)
═══════════════════════════════════════════════

All business logic lives here. No Mongoose queries in controller handlers.
Inject Role, Permission, UserRole schemas (Mongoose models) via NestJS module.
Inject optional config (userExistsValidator, redisClient, cacheTtlSeconds) via
module options or constructor pattern.

Required methods:

  // Roles
  createRole({ name, description, isDefault? })     → Role document
  getRoleById(id)                                    → Role (populated permissions); throws NotFoundError
  listRoles({ page, limit, search })                 → { data: Role[], total, page, limit }
  updateRole(id, { name, description, isDefault? })  → Role; throws NotFoundError / ConflictError
                                                       If isDefault: true, unsets isDefault on
                                                       any currently default role first.
  deleteRole(id)                                     → void; also deletes UserRole refs.
                                                       Prevent deletion if role is the current
                                                       default role (isDefault: true); throw
                                                       RbacConflictError with message:
                                                       "Cannot delete the default user role.
                                                        Assign a different default role first."
  getDefaultRole()                                   → Role | null (the role with isDefault: true)

  // Permissions
  listPermissions({ page, limit, search })           → { data: Permission[], total, page, limit }
  getPermissionByCode(code)                          → Permission | null

  // Role–Permission
  addPermissionToRole(roleId, permissionCode)        → Role (idempotent; no error if already added)
  removePermissionFromRole(roleId, permId)           → void; throws NotFoundError

  // User–Role
  assignRoleToUser(userId, roleId)                   → void (idempotent; upsert)
  removeRoleFromUser(userId, roleId)                 → void; throws NotFoundError
  getUserRoles(userId)                               → Role[] (populated permissions)

  // Permission aggregation
  getUserPermissions(userId)                         → string[] (deduplicated codes from all roles)
    When aggregating from roles, role.permissions may be populated (full documents with _id and code)
    or unpopulated (ObjectIds). If an element is a document, use permission._id when building the
    ID set and use the document's code (or resolve by ID) for the returned codes; do not use the
    document reference as an ObjectId in comparisons. This avoids incorrect permission denial when
    permissions are populated on the role.

  // Back-fill
    backfillDefaultRole({ userModel, batchSize? })     → { processed: number, backfilled: number, skipped: number }
    Assigns the default role (isDefault: true) to all users with no existing UserRole entry.
    Uses the same batched bulkWrite algorithm as the seeder (see section 9, step 7).
    Returns counts. Throws RbacNotFoundError if no default role exists.
    Throws RbacValidationError if userModel is not provided.

Pagination: all list methods accept { page, limit, search }; enforce limit max 100
server-side (clamp silently to 100 if exceeded). Return { data, total, page, limit }.

Search parameter escaping (ReDoS/regex injection — audit A05, MERN_AUDIT): Before using the
search parameter in listRoles or listPermissions in a $regex filter, escape special regex
characters so user-controlled input cannot cause ReDoS or regex injection. Use:
  const escaped = (search || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
then filter.name = { $regex: escaped, $options: 'i' } (or filter.code for listPermissions).
Never pass raw search into $regex. See RBAC_Production_Readiness_Gap_Analysis.md.

Query optimization (audit database/performance 9–10): For listRoles and listPermissions, use
.lean() on the find() query so that read-only list responses return plain objects rather than
full Mongoose documents. This reduces memory and improves response time. Example:
roleModel.find(filter).lean().skip(skip).limit(limit).sort({ name: 1 }).exec().
For listRoles, if the UI needs permission count per role, use aggregation or a separate
count; do not populate('permissions') on the list query if using .lean(). 
Do not use .lean() for getRoleById when permissions must be populated.

Idempotency:
- assignRoleToUser: use UserRole.findOneAndUpdate({ userId, roleId }, ..., { upsert: true })
  or UserRole.updateOne with { upsert: true }. Never throw on duplicate.
- addPermissionToRole: use Role.findByIdAndUpdate with $addToSet on the permissions array.
  Never throw if already present.

Error types: throw typed errors that routes catch and map to HTTP:
  RbacNotFoundError   → 404 NOT_FOUND
  RbacConflictError   → 409 CONFLICT
  RbacValidationError → 400 VALIDATION_ERROR

Cache invalidation (when Redis is enabled): after assignRoleToUser, removeRoleFromUser,
addPermissionToRole, removePermissionFromRole — call invalidateUserPermissionsCache(userId)
to delete the Redis key rbac:permissions:{userId}. On Redis error: log warning, continue.

═══════════════════════════════════════════════
8. REDIS CACHING (Optional Plug-in)
═══════════════════════════════════════════════

Behavior: When REDIS_URL is not set in .env, caching is completely absent. No import
errors. No startup crash. The app must start and work identically without Redis.

backend/src/common/lib/redis.ts:
  Export createRedisClient() — returns a connected ioredis client if REDIS_URL is set,
  otherwise returns undefined. Log "Redis caching enabled" or "Redis not configured —
  caching disabled" at startup.

backend/src/rbac/rbac.cache.ts:
  Export createCachedPermissionFetcher(rbacService, redisClient, ttlSeconds):
  - If redisClient is undefined: return (userId) => rbacService.getUserPermissions(userId)
  - If redisClient is defined:
    - Cache key: rbac:permissions:{userId}
    - On hit: parse and return cached JSON array.
    - On miss: fetch from DB via rbacService, store as JSON string with TTL.
    - On any Redis error: log warning, fall through to DB. Never crash the request.

The permissionFetcher injected into attachPermissions must come from
createCachedPermissionFetcher so caching is transparent to the middleware.

═══════════════════════════════════════════════
9. SEEDER (backend/src/rbac/rbac.seed.ts)
═══════════════════════════════════════════════

Export: async function seedRbac(options = {})
  options:
    mongoUri?          — if provided, connect to Mongo before seeding and disconnect after.
                         If omitted, assume connection is already open.
    userModel?         — the Mongoose User model from the existing auth module. Required
                         for default role back-fill. If not provided, back-fill is skipped
                         and a warning is logged: "userModel not provided — skipping
                         existing user back-fill. Pass userModel in seedRbac options."
    defaultUserRole?   — name of the role to assign to existing users during back-fill.
                         Defaults to '{{default_user_role}}' (e.g. 'user'). Must match
                         a role that is seeded in step 4 below.
    batchSize?         — number of users to process per batch during back-fill.
                         Default: 100. Used to avoid loading all users into memory at once.
    Role assignment by email is driven by env (see Section 17): SEED_SUPER_ADMIN_EMAILS,
    SEED_ADMIN_EMAILS, SEED_MANAGER_EMAILS (comma-separated). If userModel is provided,
    the seed reads these and assigns the corresponding roles to users found by email.

Production safety (audit Database / MERN_AUDIT): The script that invokes seedRbac() (e.g.
seed-runner.ts or the npm script "seed:rbac") MUST check NODE_ENV before running. If
NODE_ENV === 'production', log an error (e.g. "RBAC seed must not run in production") and
process.exit(1). This prevents accidental role/permission/back-fill mutations in production.
See RBAC_Production_Readiness_Gap_Analysis.md §2.5.

Idempotent: safe to run multiple times. Use upsert for all documents. Never fail on re-run.
Back-fill is also idempotent: UserRole unique index prevents duplicate assignments.

Steps (in order):

  1. Upsert all permission codes from getAllPermissionCodesWithWildcards().
     For each code: Permission.findOneAndUpdate({ code }, { code, description },
     { upsert: true, new: true, setDefaultsOnInsert: true })
     (Mongoose 6+: prefer returnDocument: 'after' instead of new: true if deprecation warnings appear.)
     Log: "Seeded N permissions."

  2. Upsert the four default system roles defined below. All must be created before
     permission assignments. Use findOneAndUpdate with { upsert: true, new: true }.

  ─── ROLE DEFINITIONS ────────────────────────────────────────────────────────

  ROLE 1 — super-admin
    name:        'super-admin'
    description: 'Full system access including admin and role management'
    isDefault:   false
    permissions: ['*:*'] — global wildcard only. Matches all permissions at runtime.
    Allowed:     Everything — create/manage admins, super-admins, users, roles, permissions.
    Restrictions: NONE.

  ROLE 2 — admin
    name:        'admin'
    description: 'Full application access. Cannot create or manage admin/super-admin accounts.'
    isDefault:   false
    permissions (assign all of the following — NO wildcards):
      user:create, user:view, user:update, user:delete
      task:create, task:view, task:update, task:delete, task:update-status
      role:view, permission:view, user:view-permissions
      own:profile-view, own:profile-update
      own:task-view, own:task-create, own:task-update
    Explicitly EXCLUDED (must never be assigned to admin):
      admin:create, admin:view, admin:update, admin:delete
      role:create, role:update, role:delete, role:assign, role:revoke
      permission:manage

  ROLE 3 — manager
    name:        'manager'
    description: 'Can update task status. Cannot create users or manage accounts.'
    isDefault:   false
    permissions (assign ONLY the following):
      task:view, task:update-status
      own:profile-view, own:profile-update
      own:task-view, own:task-create, own:task-update
    Explicitly EXCLUDED (must never be assigned to manager):
      user:create, user:update, user:delete, user:view
      task:create, task:delete, task:update
      Any admin:*, role:*, permission:* permissions

  ROLE 4 — user  ← this is the default role (isDefault: true)
    name:        'user'
    description: 'Standard user. Read/write access to own resources only.'
    isDefault:   true
    permissions (assign ONLY the following):
      user:view-permissions   ← required so GET /users/:id/permissions is allowed for the current user
      own:profile-view, own:profile-update
      own:task-view, own:task-create, own:task-update
    Explicitly EXCLUDED (must never be assigned to user):
      Any user:* except user:view-permissions; task:*, admin:*, role:*, permission:* permissions

  ─────────────────────────────────────────────────────────────────────────────

  3. Enforce single-default invariant before finalising user role as default:
     Role.updateMany(
       { isDefault: true, name: { $ne: 'user' } },
       { $set: { isDefault: false } }
     )
     Then set isDefault: true on the 'user' role.
     Log: "Default role set to: user."

  4. Assign permissions to each role using $addToSet (idempotent).
     Fetch each permission by code to get its _id, then push to role.permissions.
     Process in order: super-admin → admin → manager → user.
     Log: "Assigned N permissions to role: <name>."

  5. Assign roles to users by email (optional, env-driven). If userModel is provided, read env:
     SEED_SUPER_ADMIN_EMAILS, SEED_ADMIN_EMAILS, SEED_MANAGER_EMAILS (comma-separated emails).
     For each non-empty list: find users by email (userModel.find({ email: { $in: emails } })),
     then for each user create UserRole document (userId, roleId) for the corresponding role
     (super-admin, admin, manager). Use upsert or idempotent logic so re-runs do not duplicate.
     Log: "Assigned super-admin to N users.", etc. Main application seed must create demo users
     (e.g. alice, bob, carol, dave) before RBAC seed runs; recommend npm run seed:all (main then rbac).

  6. Post-seed verification (log warnings only — do not throw):
     - super-admin has the *:* permission ObjectId in its permissions array.
     - admin does NOT have admin:create, role:create, or permission:manage.
     - manager does NOT have user:create or task:create.
     - user has user:view-permissions only (no other user:*); no task:create, task:delete, task:update.
     - Exactly one role has isDefault: true.
     Log: "Seed verification passed." or "Seed WARNING: <detail>."

  7. DEFAULT ROLE BACK-FILL (existing users):
     Purpose: assign the default user role ('user') to every existing user who does
     not already have any role in the UserRole collection.
     Run only if options.userModel is provided. If not provided, log warning and skip.

     Algorithm (batched to avoid memory exhaustion):
       a. Fetch the 'user' role document to get its _id.
       b. Fetch all distinct userIds already in UserRole:
            const assignedUserIds = await UserRole.distinct('userId')
       c. Batch over User collection:
            let skip = 0; let backfilled = 0; let processed = 0
            do {
              const batch = await userModel
                .find({ _id: { $nin: assignedUserIds.map(id => mongoose.Types.ObjectId(id)) } })
                .select('_id').limit(batchSize).skip(skip).lean()
              if (batch.length === 0) break
              const ops = batch.map(user => ({
                updateOne: {
                  filter: { userId: user._id.toString(), roleId: defaultRole._id },
                  update: { $setOnInsert: { userId: user._id.toString(),
                    roleId: defaultRole._id, assignedAt: new Date(), isBackfilled: true } },
                  upsert: true
                }
              }))
              const result = await UserRole.bulkWrite(ops, { ordered: false })
              backfilled += result.upsertedCount
              processed += batch.length
              skip += batchSize
            } while (true)
       d. Log: "Back-fill complete. Processed: N. Newly assigned: M."

     Edge cases:
     - User already has ANY role → skip (do not stack the default on top).
     - Empty User collection → log "No users found — back-fill skipped." and continue.
     - bulkWrite partial failure → log each failed userId, continue (ordered: false).
     - Total failure → log and throw so seeder exits non-zero.

  8. Log summary: "RBAC seed complete." with counts of permissions, roles, and back-filled users.

No session/transaction required for MongoDB unless the target deployment uses replica
sets with transactions — document this in the README.

Running as a standalone script (e.g. npm run seed:rbac in backend/):
  Call seedRbac({ mongoUri: process.env.MONGODB_URI, userModel: <injected User model> })
  In NestJS, use a seed-runner (e.g. backend/src/rbac/seed-runner.ts) or database seeder
  that injects the User schema from the auth module.
  Exit code 0 on success. Exit code 1 on any unhandled error.

═══════════════════════════════════════════════
10. INPUT VALIDATION (backend/src/rbac/dto/*.ts)
═══════════════════════════════════════════════

Use class-validator (with class-transformer) in DTOs for all controller input. NestJS
ValidationPipe turns validation failures into 400 VALIDATION_ERROR responses with
errors array. Apply ValidationPipe globally or per-controller.

Validation rules per route:

  POST /roles:
    - body('name').notEmpty().trim().isLength({ min: 1, max: 80 })
    - body('description').optional().trim().isLength({ max: 255 })

  PATCH /roles/:id:
    - param('id').isMongoId()
    - body('name').optional().trim().notEmpty().isLength({ min: 1, max: 80 })
    - body('description').optional().trim().isLength({ max: 255 })
    - body('isDefault').optional().isBoolean().withMessage('isDefault must be a boolean')

  GET /roles, GET /permissions:
    - query('page').optional().isInt({ min: 1 }).toInt()
    - query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    - query('search').optional().trim()

  GET /roles/:id, DELETE /roles/:id:
    - param('id').isMongoId()

  POST /roles/:id/permissions:
    - param('id').isMongoId()
    - body('permissionCode').notEmpty().trim()
      .matches(/^(\*:\*|[a-z][a-z0-9_-]*:\*|[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*)$/)
      .withMessage('Invalid permission code format')

  DELETE /roles/:id/permissions/:permissionId:
    - param('id').isMongoId()
    - param('permissionId').isMongoId()

  POST /users/:id/roles:
    - param('id').notEmpty().trim()
    - body('roleId').optional().isMongoId()
    - body('roleName').optional().trim().notEmpty()
    - (at least one of roleId or roleName must be present — validate in handler)

  DELETE /users/:id/roles/:roleId, GET /users/:id/roles, GET /users/:id/permissions:
    - param('id').notEmpty().trim()
    - param('roleId').optional().isMongoId()

  POST /admin/backfill-default-role:
    - body('batchSize').optional().isInt({ min: 1, max: 500 }).toInt()
      .withMessage('batchSize must be an integer between 1 and 500')

═══════════════════════════════════════════════
11. INJECTABLE INTERFACES
═══════════════════════════════════════════════

These are the extension points for the RBAC module. In NestJS, inject via RbacModule
configuration (e.g. forRoot() or dynamic module) or RbacService constructor.

  UserExistsValidator:
    Type: async (userId: string) => boolean
    Default: async () => true (no external call; always treats user as valid)
    Use: called in POST /users/:id/roles before assigning. Return 404 if false.

  PermissionFetcher:
    Type: async (userId: string) => string[]
    Default: (userId) => rbacService.getUserPermissions(userId)
    Override: use createCachedPermissionFetcher to add Redis caching transparently.

  RbacConfig object (passed to mountRbac or RbacService):
    routePrefix:          string         — default '/api/rbac'
    userExistsValidator:  function       — default: always true
    permissionFetcher:    function       — default: DB query via service
    redisClient:          ioredis client or undefined — default: undefined
    cacheTtlSeconds:      number         — default: 300
    userModel:            Mongoose Model — default: undefined. Required for back-fill.
                          Pass the existing User model from the auth module. The RBAC
                          module only calls .find(), .distinct(), and .countDocuments()
                          on it — never modifies User documents.
    defaultUserRole:      string         — default: '{{default_user_role}}' (e.g. 'user').
                          Name of the role automatically assigned to users with no roles.

═══════════════════════════════════════════════
12. SECURITY REQUIREMENTS
═══════════════════════════════════════════════

Authentication vs Authorization:
- 401 UNAUTHENTICATED: req.user is absent or req.user.id is falsy. The user is not
  identified. Do not reveal any resource information.
- 403 PERMISSION_DENIED: req.user.id exists but the user lacks the required permission.
  Always include { requiredPermission } in the error details field.

No role-name checks:
- No code path in backend RBAC guards or rbac.service.ts may compare role names.
  All authorization uses aggregated permission strings only. Never write
  if (role.name === 'admin') anywhere in RBAC logic.

Input validation:
- All MongoDB ObjectId params: validate with IsMongoId() (class-validator) or ParseObjectIdPipe.
- All permission codes: validate with regex before any DB operation.
- All required string fields: notEmpty() + trim().
- limit query param: max 100 — return 400 VALIDATION_ERROR if exceeded (do not clamp silently).
- page query param: min 1.

Duplicate prevention:
- assignRoleToUser: upsert — never throw on duplicate.
- addPermissionToRole: $addToSet — never throw on duplicate.
- Both return 200 if already assigned.

userId safety:
- userId param must be a non-empty string. Validate with notEmpty() + trim().
- If userExistsValidator is provided: call it and return 404 NOT_FOUND if false.
- Never leak whether a userId exists when userExistsValidator is not configured.

Query safety:
- Use Mongoose model methods only. No string concatenation in queries.
- All user input passed to Mongoose is validated before the query.
- Search regex escaping (mandatory): In listRoles and listPermissions, escape the search string
  with .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') before using it in $regex. Unescaped user
  input in $regex causes ReDoS and regex injection (audit A05 — HIGH). See Section 7.

Rate limiting:
- Apply express-rate-limit to all RBAC routes. Recommended: 100 requests per 15 minutes
  per IP for read routes, 30 per 15 minutes for write routes. Document in README.
- Use environment variables: RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX.

Demo / development middleware:
- If DEMO_AUTH=true is set: mount a demo middleware that reads userId from the header
  x-demo-user-id and sets req.user = { id: headerValue }.
- If NODE_ENV === 'production' and DEMO_AUTH=true: throw at startup with message:
  "FATAL: DEMO_AUTH must not be enabled in production".
- Log visible warning at startup: "⚠️  DEMO AUTH MIDDLEWARE ACTIVE — NOT FOR PRODUCTION".

═══════════════════════════════════════════════
13. FRONTEND FLOW (REACT / NEXT.JS)
═══════════════════════════════════════════════

PERMISSION PROVIDER (frontend/src/rbac/PermissionProvider.tsx)
- Wraps the app (or a subtree). Accepts: userId, apiBaseUrl, getAuthHeaders (optional
  async function returning { Authorization: ... } or similar headers).
- On mount and when userId changes: fetch GET {apiBaseUrl}/users/{userId}/permissions.
  Use getAuthHeaders() to inject auth headers into the fetch.
- Stores permissions (string[]), isLoading (bool), error in React context.
- Exposes: permissions, isLoading, error, hasPermission(permission), refreshPermissions().
- hasPermission uses the wildcard matching algorithm from section 6. Never checks roles.
- On fetch error: log, set error state, do not crash. Expose error in context.

Optional Redux integration (frontend/src/store/slices/rbacSlice.ts), or keep state in
PermissionProvider context only:
- State: { permissions: string[], isLoading: bool, error: string | null }.
- If using Redux: async thunk fetchUserPermissions(userId); selectors for permissions
  and selectHasPermission (wildcard algorithm from section 6).
- If using context only: PermissionProvider holds permissions, isLoading, error, and
  exposes hasPermission(permission) and refreshPermissions().

usePermission hook (frontend/src/rbac/usePermission.ts):
  function usePermission(permission): { hasPermission: bool, isLoading: bool }
  Reads from PermissionProvider context (or Redux selectors if using Redux).

PermissionGate component (frontend/src/rbac/PermissionGate.tsx):
  Props: permission (string), children, fallback (optional node), loadingFallback (optional node).
  Renders loadingFallback while isLoading; children if hasPermission; fallback otherwise.
  fallback defaults to null. loadingFallback defaults to null.
  PermissionGate is a NAMED export only — do not use default export. This avoids
  "Export default doesn't exist" errors at runtime.

Barrel export (frontend/src/rbac/index.ts):
  export { PermissionProvider } from './PermissionProvider'
  export { usePermission } from './usePermission'
  export { PermissionGate } from './PermissionGate'
  // If using Redux, also re-export slice/selectors from store
  Always use named import: import { PermissionGate } from '@/rbac' — never default import.

Example usage (frontend layout or README):
  import { PermissionGate } from '@/rbac'   // named import only
  <PermissionProvider userId={currentUser.id} apiBaseUrl={process.env.NEXT_PUBLIC_API_URL}
    getAuthHeaders={async () => ({ Authorization: `Bearer ${getToken()}` })}>
    <PermissionGate permission="role:view" fallback={<p>Access denied</p>}>
      <RolesPage />
    </PermissionGate>
  </PermissionProvider>

  // With hook:
  const { hasPermission, isLoading } = usePermission('role:create');
  if (!isLoading && hasPermission) return <CreateRoleButton />;

Frontend must consume permissions from the backend API only.
No role name checks anywhere in UI logic.

Security and audit (score 9–10): If the application stores JWT in localStorage, document in
README that this is vulnerable to XSS and recommend for production either (a) httpOnly
cookie-based auth from the backend, or (b) strict Content-Security-Policy (CSP) and input
sanitization. PermissionProvider does not store tokens; it uses the app's API client. Adding
CSP via next.config.js headers or a meta tag improves security audit scores.

═══════════════════════════════════════════════
14. RBAC ADMIN UI (REACT)
═══════════════════════════════════════════════

Purpose: A fully functional, self-contained RBAC administration panel built in React +
Redux. It allows authorised users to manage roles, permissions, user–role assignments,
and trigger the default role back-fill — entirely through the RBAC API, with no
hardcoded role checks anywhere in UI logic.

The admin UI lives under frontend/src/app/rbac-admin/ (Next.js App Router) and is
mounted as a protected route. All panels are gated by PermissionGate using the same
permission codes defined in the registry. Users without the required permission see
an "Access Denied" message, not a crash.

--- ROUTING (Next.js App Router: frontend/src/app/rbac-admin/) ---

Mount the admin panel under the path /rbac-admin. Use App Router layout and route
segments. Use layout.tsx for sidebar and breadcrumb; each segment is a page.tsx.

  /rbac-admin                    → layout.tsx (RbacAdminLayout: sidebar + children)
  /rbac-admin/roles              → roles/page.tsx (RolesPage)     [requires: role:view]
  /rbac-admin/roles/[id]         → roles/[id]/page.tsx (RoleDetailPage) [requires: role:view]
  /rbac-admin/permissions         → permissions/page.tsx            [requires: permission:view]
  /rbac-admin/users               → users/page.tsx (UserRolesPage) [requires: role:view]
  /rbac-admin/settings            → settings/page.tsx              [requires: role:assign]

RbacAdminLayout (layout.tsx):
- Left sidebar with nav links to each section (Link components to /rbac-admin/roles, etc.).
- Each nav link visible only if the user has the required permission (use usePermission hook).
- Active link highlighted. Breadcrumb at top of content area.
- No styling library required — use Tailwind or plain CSS; keep styling clean and functional.

--- ROLES PAGE (frontend/src/app/rbac-admin/roles/page.tsx) ---
[requires: role:view to view; role:create to see Create button; role:delete to see Delete]

Displays a paginated table of all roles. Columns:
  Name | Description | Default? | Permissions (count) | Users (count) | Created At | Actions

Features:
- Search input (debounced, 300ms) — filters by role name via GET /roles?search=...
- Pagination controls (prev / next / page numbers). Page size selector (10, 20, 50).
- "Create Role" button — opens CreateRoleModal (gated by role:create).
- Each row: "Edit" button → navigates to /admin/rbac/roles/:id.
- Each row: "Delete" button (gated by role:delete) — opens ConfirmDeleteModal.
  Prevent deletion if role isDefault: true; show inline warning instead.
- "Set as Default" toggle button per row (gated by role:update) — calls PATCH /roles/:id
  with { isDefault: true }. Shows current default role with a badge (e.g. "Default").
- Loading skeleton rows while fetching. Error banner if API call fails.
- Defensive list handling: set list state only when the parsed result has an array
  (e.g. if (Array.isArray(res?.data)) setRoles(res.data)); on catch set list to [] and show toast.
  In render use (roles ?? []).map(...) so undefined state never causes "undefined is not an object
  (evaluating 'roles.map')".   Differentiate list fetch errors: 403 → "Permission denied",
  401 → "Please log in", else → "Failed to load roles".
  Use a shared API error helper (e.g. getApiErrorMessage(err) in lib/getApiError.ts) that
  returns { message: string, status?: number } from an axios error so all RBAC admin catch
  blocks show consistent, type-safe messages (audit code quality 9–10).

CreateRoleModal:
- Fields: Name (required, text), Description (optional, textarea), Is Default (checkbox).
- Inline validation: name required, max 80 chars. Show field-level error messages.
- Submit calls POST /roles. On success: close modal, refresh table, show success toast.
- On 409 CONFLICT: show "Role name already exists" under the name field.
- Cancel button closes modal without saving.

ConfirmDeleteModal:
- Shows role name. Warns if the role has assigned users (show count).
- Two buttons: "Cancel" and "Delete" (destructive, red). Delete calls DELETE /roles/:id.
- On success: close modal, refresh table, show success toast.
- On error: show error message inside modal.

Redux (store/slices/rolesSlice.js):
  State: { roles: Role[], total: number, page: number, limit: number,
           isLoading: bool, error: string | null, searchQuery: string }
  Thunks: fetchRoles({ page, limit, search }), createRole(data), updateRole(id, data),
          deleteRole(id), setDefaultRole(id)
  Selectors: selectRoles, selectRolesTotal, selectRolesLoading, selectRolesError

--- ROLE DETAIL PAGE (frontend/src/app/rbac-admin/roles/[id]/page.tsx) ---
[requires: role:view; role:update to edit; permission:manage to manage permissions]

Two-panel layout:

  Left panel — Role Info:
  - Displays and allows editing: name, description, isDefault toggle.
  - "Save Changes" button (gated by role:update) — calls PATCH /roles/:id.
  - Show last updated timestamp.
  - Inline success/error feedback on save.

  Right panel — Permissions:
  - Lists all permissions currently assigned to this role (code + description).
  - "Remove" button per permission (gated by permission:manage) — calls
    DELETE /roles/:id/permissions/:permissionId. Confirms before removing.
  - "Add Permission" section below the list:
    - Searchable dropdown or multi-select of all available permissions
      (fetched from GET /permissions, paginated, searchable by code).
    - "Add" button — calls POST /roles/:id/permissions with { permissionCode }.
    - Idempotent: if already assigned, show "Already assigned" rather than an error.
  - Show permission count badge in the panel header.

  Bottom panel — Assigned Users (read-only):
  - Paginated list of userIds that have this role (from GET /users/:id/roles queried
    in reverse — add a backend endpoint if needed: GET /roles/:id/users).
  - If GET /roles/:id/users is not available: show "N users assigned" count only,
    with a note that individual user management is available on the Users page.

Redux: rolesSlice handles role detail fetch and updates. permissionsSlice handles the
available permissions list for the add-permission dropdown.

--- PERMISSIONS PAGE (frontend/src/app/rbac-admin/permissions/page.tsx) ---
[requires: permission:view]

Read-only reference page. Displays all registered permissions in a searchable,
paginated table. Columns: Code | Description | Assigned to N roles | Created At

Features:
- Search input (debounced) — filters by code.
- Pagination controls. No create/delete — permissions are managed via the registry
  and seeder, not via the UI. Show a note: "Permissions are defined in the code
  registry and seeded automatically. To add new permissions, update the registry
  and re-run the seeder."
- Each row shows which roles have that permission (as a comma-separated list of role
  name badges, max 3 shown with "+N more" overflow).
- Loading and error states. Use defensive array handling as on Roles page: only set
  permissions from API when result is an array; render with (permissions ?? []).map;
  on catch show 403 → "Permission denied", 401 → "Please log in", else → "Failed to load permissions".

Redux (store/slices/permissionsSlice.js):
  State: { permissions: Permission[], total, page, limit, isLoading, error, searchQuery }
  Thunks: fetchPermissions({ page, limit, search })
  Selectors: selectPermissions, selectPermissionsLoading

--- USER ROLES PAGE (frontend/src/app/rbac-admin/users/page.tsx) ---
[requires: role:view to view; role:assign to assign; role:revoke to revoke]

Allows admins to look up any user by userId and manage their role assignments.

Layout:
- Search bar at top: enter a userId (string input). On submit, fetch
  GET /users/:id/roles and GET /users/:id/permissions. Display results below.
- If userExistsValidator is configured and returns 404: show "User not found" message.

User detail panel (shown after search):
  - Header: userId, list of assigned role names as badges.
  - Current Roles table: Role Name | Description | Default? | Assigned At | Backfilled? | Actions
    - "Revoke" button per role (gated by role:revoke) — calls DELETE /users/:id/roles/:roleId.
      Confirm before revoking. Show warning if revoking the only role.
  - Aggregated Permissions panel (collapsible): lists all permission codes the user
    currently has (from GET /users/:id/permissions). Displayed as a tag cloud or
    comma-separated list. Read-only.
  - "Assign Role" section (gated by role:assign):
    - Dropdown of all roles (from GET /roles). Searchable.
    - "Assign" button — calls POST /users/:id/roles with { roleId }.
    - If already assigned: show "Role already assigned" inline.
  - "Back-fill Default Role" button (gated by role:assign): triggers
    POST /admin/backfill-default-role with default batchSize. Shows progress
    (processed / backfilled counts) in a result banner after completion.
    Disable button and show spinner while in progress.

Redux (store/slices/userRolesSlice.js):
  State: { currentUserId: string | null, userRoles: Role[], userPermissions: string[],
           isLoading: bool, error: string | null, backfillResult: object | null,
           backfillLoading: bool }
  Thunks: fetchUserRoles(userId), fetchUserPermissions(userId), assignRole(userId, roleId),
          revokeRole(userId, roleId), triggerBackfill(batchSize?)
  Selectors: selectUserRoles, selectUserPermissions, selectBackfillResult

--- RBAC SETTINGS PAGE (frontend/src/app/rbac-admin/settings/page.tsx) ---
[requires: role:assign]

System-level RBAC management actions.

Sections:

  Default Role:
  - Shows the current default role name and description (fetched from GET /roles with
    a filter or by checking isDefault: true in the roles list).
  - "Change Default Role" — dropdown of all roles + Save button.
    Calls PATCH /roles/:id with { isDefault: true } on the selected role.
    Warns: "This will not automatically reassign existing users. Use Back-fill below."

  Back-fill Default Role:
  - Explanation: "Assign the default role to all users who currently have no roles."
  - Batch size input (number, default 100, max 500).
  - "Run Back-fill" button — calls POST /admin/backfill-default-role.
  - Shows result after completion: processed, backfilled, skipped counts.
  - Shows spinner and disables button while running.
  - Shows last run timestamp (stored in component state, not persisted).

  Permissions Sync (read-only info):
  - Shows total permission count from GET /permissions.
  - Message: "To add or remove permissions, update the registry and re-run npm run seed."

--- SHARED UI COMPONENTS (frontend/src/app/rbac-admin/components/) ---

Provide these reusable components used across all RBAC admin pages:

  RbacTable.jsx
    Props: columns (array of { key, label, render? }), rows (array), isLoading (bool),
           emptyMessage (string), onRowClick? (fn).
    Renders a table with loading skeleton (5 skeleton rows) and empty state.
    No external table library — plain HTML table with CSS.

  RbacPagination.jsx
    Props: page, limit, total, onPageChange, onLimitChange.
    Shows page numbers, prev/next buttons, total count, page size selector.
    Disables prev on page 1, next on last page.

  RbacModal.jsx
    Props: isOpen, onClose, title, children, footer?.
    Simple modal with overlay, close on Escape key and overlay click.
    Traps focus inside modal when open (accessibility).

  RbacSearchInput.jsx
    Props: value, onChange, placeholder, debounceMs (default 300).
    Debounced search input. Shows clear button when value is non-empty.

  RbacToast.jsx
    Props: message, type ('success' | 'error' | 'info'), onClose.
    Auto-dismisses after 4 seconds. Fixed position bottom-right.
    RbacToastContainer manages a list of active toasts (stored in component state).

  RbacBadge.jsx
    Props: label, variant ('default' | 'primary' | 'danger' | 'success').
    Small pill badge for role names, default indicators, backfill tags.

  AccessDenied.jsx
    Shown by PermissionGate fallback in admin routes. Displays a clear message:
    "You do not have permission to access this section."
    Includes a back button.

--- REDUX STORE INTEGRATION ---

Add all new slices to the existing store (src/store/store.js):
  rolesSlice       → reducer key: 'rbacRoles'
  permissionsSlice → reducer key: 'rbacPermissions'
  userRolesSlice   → reducer key: 'rbacUserRoles'

All thunks use the getAuthHeaders pattern from the existing auth slice to inject
the Authorization header into every API call. Access the token via
(state) => state.auth.token or via thunkAPI.getState().auth.token — match the
pattern of the existing authSlice in the codebase.

All API calls use a shared rbacApi utility (frontend/src/app/rbac-admin/utils/rbacApi.ts):
  Export: createRbacApi(baseUrl, getToken) or use the app's existing axios instance with baseURL.
  Returns an object with get(path, params?), post(path, body?), patch(path, body?),
  delete(path) methods that inject Authorization header and parse the success/error
  envelope automatically. Throw a typed RbacApiError on non-2xx responses with
  { code, message, details } fields from the error envelope.

  List response parsing (critical): The backend interceptor wraps list responses as
  { success: true, data: { data: T[], meta }, timestamp }. For listRoles and listPermissions,
  parse the axios response: body = response.data, inner = body.data. If inner is
  { data: array, meta }, use it; if inner is an array, treat as list and build meta from length
  or defaults. Always return { data: T[], meta: ListMeta } from list helpers so list pages
  can rely on res.data (array) and res.meta — list pages must never see undefined .data.

--- ADMIN PANEL ENTRY POINT (frontend/src/app/rbac-admin/page.tsx) ---

Barrel export:
  export { RbacAdminRouter } from './RbacAdminRouter'
  export { rolesSlice } from '../../store/slices/rolesSlice'
  export { permissionsSlice } from '../../store/slices/permissionsSlice'
  export { userRolesSlice } from '../../store/slices/userRolesSlice'

--- MOUNTING THE ADMIN PANEL ---

In the existing app router or layout (e.g. Next.js layout.tsx or src/App.jsx):
  import { PermissionGate } from '@/rbac'
  import { RbacAdminRouter } from './pages/rbac-admin'  // or rbac-admin layout

  // Gate the admin area with role:view; use named import for PermissionGate.
  <PermissionGate permission="role:view" fallback={<AccessDenied />}>
    <RbacAdminRouter />
  </PermissionGate>

The top-level gate uses role:view as the minimum permission to enter the admin area.
Individual pages apply their own gates for more specific actions.

--- BACKEND ADDITION REQUIRED FOR UI ---

Add one additional backend endpoint required by the Role Detail Page:

  GET {{api_prefix}}/roles/:id/users     [requires: role:view]
    Returns a paginated list of userIds assigned to a given role.
    Query: page (default 1), limit (default 20, max 100).
    Response: 200 + { data: [{ userId, assignedAt, isBackfilled }], meta: { page, limit, total } }
    404 NOT_FOUND if role does not exist.

  Add validation: param('id').isMongoId()
  Add service method: getUsersByRole(roleId, { page, limit }) → { data, total, page, limit }
    Uses UserRole.find({ roleId }).skip().limit() with count.

═══════════════════════════════════════════════
15. UNIT TESTS (≥90% COVERAGE) — MANDATORY FOR AUDIT 9–10
═══════════════════════════════════════════════

Purpose: A complete test suite covering the RBAC module's backend logic, middleware,
routes, seeder, registry, and frontend permission layer. Tests must be runnable with
a single command and achieve ≥90% line and branch coverage as reported by the coverage
tool. No test should depend on a live database or running server.

Audit requirement: Tests are mandatory for MERN_AUDIT score 9–10. Zero tests on frontend
or backend RBAC will result in review_required or fail (gate rule: zero tests on either
layer = fail). Implement all listed backend and frontend RBAC test files; ensure npm test
(backend) and npm test (frontend) run and meet coverage thresholds. CI should run tests
and enforce coverageThreshold so RBAC modules cannot merge with zero or low coverage.

--- TEST STACK ---

Backend:
  Framework:   Jest (jest + @jest/globals)
  HTTP mocking: supertest (for route integration tests)
  DB mocking:  jest-mongoose-mock or manual jest.mock() for all Mongoose models
  Coverage:    jest --coverage with lcov + text reporters
  Config file: jest.config.js at project root
  Script:      "test": "jest --coverage", "test:watch": "jest --watch"
  Threshold:   Target ≥90% lines/branches/functions/statements for audit 9–10. Set in jest.config.js
               (or a dedicated jest.rbac.config.js) under coverageThreshold. For RBAC-only runs, either:
               (a) enforce threshold for paths matching src/rbac/** in the main config, or
               (b) use a separate config (e.g. jest.rbac.config.js) with collectCoverageFrom limited to
               the RBAC files that have specs (service, registry, guards, utils, errors, schemas); enforce
               a minimum threshold (e.g. 75% lines, 68% branches) so CI fails if coverage drops, with 90%
               as the target when seed, cache, and controller specs are added. See RBAC_Production_Readiness_Gap_Analysis.md §2.6.

Frontend:
  Framework:   Jest + React Testing Library (@testing-library/react, @testing-library/jest-dom)
  Store:       Test with real Redux store (not mocked) using a test-store factory
  Fetch mock:  jest-fetch-mock or msw (Mock Service Worker) for API calls
  Coverage:    same threshold as backend

--- BACKEND TEST FILES ---

tests/rbac/rbac.registry.test.js
  Covers: rbac.registry.js — all exports and validation logic.

  Test cases:
  1. PERMISSIONS object contains all expected keys and values
     - Verify ROLE_CREATE === 'role:create', ADMIN_CREATE === 'admin:create', etc.
     - Verify GLOBAL_WILDCARD === '*:*'
     - Verify total key count matches expected number of permissions

  2. getAllPermissionCodes() — standard codes only
     - Returns an array
     - Does NOT include '*:*'
     - Does NOT include any 'module:*' wildcards
     - Includes 'role:create', 'user:create', 'task:update-status', 'own:task-view', etc.
     - Array has no duplicates

  3. getAllPermissionCodesWithWildcards() — includes wildcards
     - Includes '*:*'
     - Includes getAllPermissionCodes() as a subset
     - Array has no duplicates

  4. isValidPermissionCode(code) — regex validation
     - Returns true: 'role:create', 'task:update-status', 'own:task-view', '*:*', 'role:*'
     - Returns false: '', 'invalid', 'ROLE:create', 'role:', ':create', 'role:create:extra'
     - Returns false: null, undefined, 123 (non-string inputs)
     - Returns true: 'a:b', 'abc-def:ghi_jkl', 'x:*'

tests/rbac/rbac.wildcard.test.js  (or backend/src/rbac/utils/wildcard.matcher.spec.ts)
  Covers: the matchesPermission algorithm (Section 6). Extract as a pure util function
  and test exhaustively. This file must achieve 100% branch coverage on the algorithm.

backend/src/rbac/utils/regex-escape.spec.ts  (NestJS: colocate with util)
  Covers: escapeForRegex (or equivalent) used to escape search before $regex in listRoles/listPermissions.
  Test cases: null/undefined → empty string; special regex chars (., *, +, ?, [, ], etc.) escaped;
  no special chars → unchanged. Required for audit A05 (ReDoS/injection).

  Test cases:
  1. Global wildcard '*:*' in userPermissions
     - matchesPermission(['*:*'], 'role:create') → true
     - matchesPermission(['*:*'], 'admin:delete') → true
     - matchesPermission(['*:*'], 'own:task-view') → true
     - matchesPermission(['*:*'], 'anything:whatever') → true

  2. Exact match
     - matchesPermission(['role:create'], 'role:create') → true
     - matchesPermission(['role:create'], 'role:view') → false
     - matchesPermission(['task:view', 'task:update-status'], 'task:update-status') → true
     - matchesPermission([], 'role:create') → false

  3. Module wildcard 'module:*'
     - matchesPermission(['role:*'], 'role:create') → true
     - matchesPermission(['role:*'], 'role:delete') → true
     - matchesPermission(['role:*'], 'user:create') → false (different module)
     - matchesPermission(['task:*'], 'task:update-status') → true
     - matchesPermission(['own:*'], 'own:task-view') → true

  4. No match
     - matchesPermission(['user:create'], 'user:delete') → false
     - matchesPermission(['admin:create'], 'admin:view') → false
     - matchesPermission(['task:view'], 'task:create') → false

  5. Multiple permissions in array
     - matchesPermission(['role:view', 'user:create', 'task:update-status'], 'task:update-status') → true
     - matchesPermission(['role:view', 'user:create'], 'task:create') → false

  6. Edge cases
     - matchesPermission(null, 'role:create') → false (handle gracefully)
     - matchesPermission([], '') → false
     - matchesPermission(['*:*'], '') → true (wildcard matches empty — document behaviour)

tests/rbac/rbac.service.test.js
  Covers: rbac.service.js — all service methods. Mock all Mongoose model calls with
  jest.fn(). Use a factory to create a service instance with mocked deps.

  Setup: mock Role, Permission, UserRole with jest.mock('../../schemas/role.schema') or
  NestJS testing module (getModelToken) for backend tests.
  Each test resets all mocks with beforeEach(() => jest.clearAllMocks()).

  Test cases — Roles:
  1. createRole — success: calls Role.create with correct data, returns role doc
  2. createRole — conflict: Role.create throws duplicate key error (code 11000),
     service throws RbacConflictError
  3. getRoleById — found: calls Role.findById().populate(), returns populated role
  4. getRoleById — not found: Role.findById returns null, throws RbacNotFoundError
  5. listRoles — returns paginated result with correct skip/limit/countDocuments calls
  6. listRoles — with search: builds regex query on name field
  7. updateRole — success: calls Role.findByIdAndUpdate with correct partial data
  8. updateRole — setDefault: calls Role.updateMany to unset previous default first
  9. updateRole — not found: throws RbacNotFoundError
  10. deleteRole — success: calls Role.findByIdAndDelete + UserRole.deleteMany
  11. deleteRole — is default: throws RbacConflictError with "Cannot delete default role"
  12. getDefaultRole — found: returns role with isDefault: true
  13. getDefaultRole — none found: returns null

  Test cases — Permissions:
  14. listPermissions — returns paginated permissions
  15. getPermissionByCode — found and not found cases

  Test cases — Role–Permission:
  16. addPermissionToRole — success: calls Role.findByIdAndUpdate with $addToSet
  17. addPermissionToRole — permission not found: throws RbacNotFoundError
  18. removePermissionFromRole — success: calls Role.findByIdAndUpdate with $pull
  19. removePermissionFromRole — role not found: throws RbacNotFoundError

  Test cases — User–Role:
  20. assignRoleToUser — success: calls UserRole.updateOne with upsert: true
  21. assignRoleToUser — with userExistsValidator returning false: throws RbacNotFoundError
  22. assignRoleToUser — with userExistsValidator returning true: proceeds normally
  23. removeRoleFromUser — success: calls UserRole.deleteOne
  24. removeRoleFromUser — not found: throws RbacNotFoundError
  25. getUserRoles — returns populated roles for userId

  Test cases — getUserPermissions:
  26. getUserPermissions — user with multiple roles: returns deduplicated permission codes
  27. getUserPermissions — user with no roles: returns []
  28. getUserPermissions — role with *:* permission: includes '*:*' in output
  29. getUserPermissions — deduplication: same code from two roles appears once

  Test cases — backfillDefaultRole:
  30. success: calls UserRole.distinct, userModel.find, UserRole.bulkWrite; returns counts
  31. no default role: throws RbacNotFoundError
  32. no userModel: throws RbacValidationError
  33. empty user collection: returns { processed: 0, backfilled: 0, skipped: 0 }

tests/rbac/rbac.middleware.test.js
  Covers: rbac.middleware.js — attachPermissions and authorize.
  Mock permissionFetcher as a jest.fn(). Use mock req/res/next objects.

  attachPermissions tests:
  1. req.user missing → calls next() is NOT called, res.status(401) called
  2. req.user.id missing → 401 UNAUTHENTICATED
  3. permissionFetcher called with req.user.id
  4. result attached to req.permissions
  5. permissionFetcher throws → 500 INTERNAL_ERROR
  6. req.permissions already set → does not call permissionFetcher again (cache hit)

  authorize tests:
  7. req.user missing → 401 UNAUTHENTICATED
  8. req.permissions missing (attachPermissions not called first) → 401
  9. user has exact permission → calls next()
  10. user has '*:*' → calls next() (global wildcard)
  11. user has 'role:*' and required is 'role:create' → calls next() (module wildcard)
  12. user does not have required permission → 403 PERMISSION_DENIED with requiredPermission in details
  13. 403 error details.requiredPermission matches the permission string passed to authorize()

tests/rbac/rbac.routes.test.js
  Covers: all HTTP routes via supertest. Mock rbacService methods. Set req.user via
  a test auth middleware that sets req.user = { id: 'test-user-id' } and
  req.permissions = ['*:*'] for admin tests, or specific permissions for access-denial tests.

  Roles route tests:
  1. POST /roles — 201 on valid input
  2. POST /roles — 400 on missing name
  3. POST /roles — 409 on duplicate name (service throws RbacConflictError)
  4. POST /roles — 403 when req.permissions lacks role:create
  5. GET /roles — 200 with paginated data
  6. GET /roles — 400 if limit > 100
  7. GET /roles/:id — 200 with populated role
  8. GET /roles/:id — 404 on unknown id
  9. GET /roles/:id — 400 on invalid MongoId format
  10. PATCH /roles/:id — 200 on valid partial update
  11. PATCH /roles/:id — 409 on name conflict
  12. PATCH /roles/:id — 404 on unknown id
  13. DELETE /roles/:id — 204 on success
  14. DELETE /roles/:id — 409 when role is default (service throws RbacConflictError)
  15. DELETE /roles/:id — 404 on unknown id

  Role–Permission route tests:
  16. POST /roles/:id/permissions — 200 on valid permissionCode
  17. POST /roles/:id/permissions — 400 on invalid permission format
  18. POST /roles/:id/permissions — 404 when role not found
  19. DELETE /roles/:id/permissions/:permissionId — 204 on success
  20. DELETE /roles/:id/permissions/:permissionId — 404 when not found

  User–Role route tests:
  21. POST /users/:id/roles — 201 on valid roleId
  22. POST /users/:id/roles — 201 on valid roleName
  23. POST /users/:id/roles — 400 when neither roleId nor roleName provided
  24. POST /users/:id/roles — 404 when role not found
  25. DELETE /users/:id/roles/:roleId — 204 on success
  26. DELETE /users/:id/roles/:roleId — 404 when not found
  27. GET /users/:id/permissions — 200 with aggregated permission codes
  28. GET /users/:id/permissions — 401 when req.user missing
  29. POST /admin/backfill-default-role — 200 with result counts
  30. POST /admin/backfill-default-role — 501 when userModel not injected

tests/rbac/rbac.seed.test.js
  Covers: rbac.seed.js — idempotency, role creation, permission assignment, back-fill.
  Mock all Mongoose models and operations with jest.fn().

  Test cases:
  1. Creates all 4 system roles (super-admin, admin, manager, user)
  2. Assigns *:* to super-admin only
  3. admin role does NOT receive admin:create permission
  4. manager role does NOT receive user:create or task:create
  5. user role does NOT receive any user:* or task:* permissions
  6. user role has isDefault: true after seeding
  7. Exactly one role has isDefault: true (single-default invariant enforced)
  8. Is idempotent: calling seedRbac twice does not throw or create duplicates
  9. Back-fill: UserRole.bulkWrite called with correct ops when userModel provided
  10. Back-fill skipped with warning when userModel not provided
  11. Back-fill skipped gracefully when User collection is empty
  12. Seed verification logs warning if admin has forbidden permission

tests/rbac/rbac.defaultRoles.test.js
  Covers: the exact permission boundary rules for each of the 4 seeded roles.
  This file specifically validates the role access matrix. Use matchesPermission
  (the pure function from section 6) against each role's seeded permission set.

  Setup: call seedRbac() with mocked models, capture the permissions assigned to
  each role, then run assertions.

  super-admin assertions:
  1. matchesPermission(['*:*'], 'admin:create') → true
  2. matchesPermission(['*:*'], 'role:create') → true
  3. matchesPermission(['*:*'], 'user:delete') → true
  4. matchesPermission(['*:*'], 'own:task-view') → true

  admin assertions:
  5. Has 'user:create' → true
  6. Has 'task:create' → true
  7. Has 'task:update-status' → true
  8. Does NOT have 'admin:create' → matchesPermission(adminPerms, 'admin:create') → false
  9. Does NOT have 'role:create' → false
  10. Does NOT have 'permission:manage' → false
  11. Does NOT have 'role:assign' → false

  manager assertions:
  12. Has 'task:view' → true
  13. Has 'task:update-status' → true
  14. Has 'own:task-view' → true
  15. Does NOT have 'user:create' → false
  16. Does NOT have 'task:create' → false
  17. Does NOT have 'task:delete' → false
  18. Does NOT have 'task:update' (full update, not status) → false
  19. Does NOT have 'role:view' → false

  user assertions:
  20. Has 'own:profile-view' → true
  21. Has 'own:task-create' → true
  22. Has 'own:task-update' → true
  23. Does NOT have 'user:create' → false
  24. Does NOT have 'task:view' → false
  25. Does NOT have 'task:create' → false
  26. Does NOT have 'role:view' → false
  27. isDefault is true on the user role document

tests/rbac/rbac.cache.test.js
  Covers: rbac.cache.js — Redis caching layer.

  Test cases:
  1. No redisClient → returns raw service.getUserPermissions() result directly
  2. Redis hit → returns cached JSON, does NOT call service
  3. Redis miss → calls service, stores result in Redis with correct TTL
  4. Redis GET throws → logs warning, falls back to service (does NOT crash)
  5. Redis SET throws → logs warning, returns service result (does NOT crash)
  6. Cache key format: 'rbac:permissions:{userId}'
  7. Stored value is JSON.stringify of permissions array
  8. TTL is passed correctly to Redis SET command

--- FRONTEND TEST FILES ---

frontend/src/rbac/__tests__/usePermission.test.ts
  Covers: usePermission hook.

  Test cases:
  1. Returns { hasPermission: true, isLoading: false } when permission present in store
  2. Returns { hasPermission: false, isLoading: false } when permission absent
  3. Returns { hasPermission: false, isLoading: true } when store is loading
  4. Wildcard '*:*' in store permissions → hasPermission true for any tested permission
  5. Module wildcard 'role:*' → hasPermission true for 'role:create'
  6. Throws/errors when used outside a Redux Provider (test with renderHook without store)

frontend/src/rbac/__tests__/PermissionGate.test.tsx
  Covers: PermissionGate component.

  Test cases:
  1. Renders children when user has permission
  2. Renders fallback when user lacks permission (fallback prop provided)
  3. Renders null when user lacks permission (no fallback prop)
  4. Renders loadingFallback while isLoading: true
  5. Renders children (not loadingFallback) once loading completes and permission granted
  6. Renders fallback (not loadingFallback) once loading completes and permission denied
  7. Does not render children when permission check is false, even if children are complex

frontend/src/rbac/__tests__/PermissionProvider.test.tsx
  Covers: PermissionProvider component and context.

  Test cases:
  1. Fetches GET /users/:userId/permissions on mount
  2. Calls getAuthHeaders() and passes Authorization header in the fetch
  3. Sets permissions in context after successful fetch
  4. Sets isLoading: true during fetch, false after
  5. Sets error in context on fetch failure — does not crash
  6. refreshPermissions() re-fetches the API
  7. Re-fetches when userId prop changes
  8. hasPermission('role:create') returns true when 'role:create' in permissions
  9. hasPermission uses wildcard algorithm: '*:*' → always true
  10. hasPermission('role:*') for module wildcard → correct matching

frontend/src/store/slices/__tests__/rbacSlice.test.ts (if using Redux)
  Covers: rbacSlice — reducer, thunks, selectors.

  Test cases:
  1. Initial state: { permissions: [], isLoading: false, error: null }
  2. fetchUserPermissions.pending → isLoading: true
  3. fetchUserPermissions.fulfilled → permissions set, isLoading: false
  4. fetchUserPermissions.rejected → error set, isLoading: false
  5. permissionsCleared action → resets to initial state
  6. selectPermissions returns permissions array
  7. selectIsLoading returns loading state
  8. selectHasPermission(state, 'role:create') → true when 'role:create' in permissions
  9. selectHasPermission(state, 'role:create') → false when absent
  10. selectHasPermission uses wildcard algorithm (test '*:*' and 'role:*' cases)

frontend/src/store/slices/__tests__/rolesSlice.test.ts (if using Redux)
  Covers: rolesSlice — roles admin panel Redux slice.

  Test cases:
  1. fetchRoles.fulfilled → roles and total set in state
  2. createRole.fulfilled → new role added to state, total incremented
  3. updateRole.fulfilled → existing role updated in place
  4. deleteRole.fulfilled → role removed from state
  5. setDefaultRole.fulfilled → isDefault toggled correctly (old default unset, new one set)
  6. Loading and error states for each async thunk (pending/rejected)
  7. selectRoles, selectRolesTotal, selectRolesLoading selectors return correct slices

--- TEST CONFIGURATION ---

Backend (backend/): NestJS uses Jest; config in package.json or jest.config.js/ts.
  testMatch: ['**/*.spec.ts'], or separate test/ folder for e2e.
  collectCoverageFrom: [
    'src/rbac/**/*.ts',
    'src/common/lib/redis.ts',
    '!**/node_modules/**', '!**/*.module.ts'
  ]
  coverageThreshold: target ≥90% lines/branches/functions/statements for audit 9–10. Enforce in CI so
  merge is blocked if coverage drops. If using a dedicated RBAC config (e.g. jest.rbac.config.js) that
  only collects from a subset of src/rbac (e.g. service, registry, guards, utils, errors, schemas), set a
  minimum threshold (e.g. 75% lines, 68% branches) and raise toward 90% as seed/cache/controller specs are added.

Frontend (frontend/): If Jest is configured (e.g. with jest.config.js or next/jest):
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  collectCoverageFrom: [
    'src/rbac/**/*.{ts,tsx}',
    'src/store/slices/rbac*.ts', 'src/store/slices/roles*.ts', ... (if using Redux)
  ]
  Enforce coverage threshold for src/rbac so audit testing dimension reaches 9–10.

Backend test setup: Mock Mongoose models (getModelToken) or use in-memory DB; do not
require live MongoDB for unit tests.

--- PACKAGE.JSON SCRIPTS (backend) ---

  "test":           "jest" or "jest --coverage"
  "test:watch":     "jest --watch"
  "test:cov":       "jest --coverage"
  "test:rbac":      "jest rbac --passWithNoTests"   (optional: RBAC-only unit tests)
  "test:rbac:cov":  "jest rbac --config jest.rbac.config.js --coverage --passWithNoTests"   (optional: RBAC coverage with threshold)
  "test:e2e":       "jest --config ./test/jest-e2e.json"

--- PACKAGE.JSON SCRIPTS (frontend) ---

  "test":           "jest" or "next test" (if test runner is configured)
  "test:ci":        "CI=true npm test"

--- COVERAGE REQUIREMENTS ---

The following files should meet or exceed 90% line coverage where applicable:
  backend/src/rbac/rbac.service.ts        ≥90% (or ≥75% minimum with goal 90%)
  backend/src/rbac/guards/*.ts           ≥90%
  backend/src/rbac/rbac.registry.ts      100% (pure functions)
  backend/src/rbac/utils/wildcard.matcher.ts  100% (pure algorithm)
  backend/src/rbac/utils/regex-escape.ts ≥90% (used for listRoles/listPermissions search escaping)
  backend/src/rbac/rbac.seed.ts          ≥90%
  backend/src/rbac/rbac.cache.ts         ≥90%
  frontend/src/rbac/usePermission.ts     ≥90%
  frontend/src/rbac/PermissionGate.tsx   ≥90%
  frontend/src/rbac/PermissionProvider.tsx ≥90%
  frontend/src/store/slices/rbacSlice.ts ≥90% (if using Redux)

═══════════════════════════════════════════════
16. FLUTTER INTEGRATION
═══════════════════════════════════════════════

PermissionService (lib/rbac/permission_service.dart):
  Constructor: baseUrl (String), userId (String), httpClient (injectable abstract client),
    cacheTtlSeconds (int, default 300).
  Methods:
    Future<void> init()                  — fetches + caches permissions in memory.
    bool hasPermission(String permission) — uses wildcard algorithm from section 6.
    Future<void> refresh()               — re-fetches and updates cache.
    void clearCache()                    — clears in-memory permissions.
    bool get isLoaded                    — true after successful init().
  Error handling: catch network errors; set error state; never crash. Expose isLoaded = false.

Abstract HttpClient interface (lib/rbac/http_client.dart):
  abstract class RbacHttpClient {
    Future<Map<String, dynamic>> get(String url, { Map<String, String>? headers });
  }
  Provide a default implementation using the http package (DioHttpClient or HttpPackageClient).

PermissionGuard widget (lib/rbac/permission_guard.dart):
  Constructor: service (PermissionService), permission (String), child (Widget),
    fallback (Widget?, default SizedBox.shrink()), loadingWidget (Widget?, default CircularProgressIndicator()).
  Behavior: shows loadingWidget while !service.isLoaded; shows child if hasPermission; shows fallback otherwise.

Barrel export (lib/rbac/rbac_exports.dart):
  export 'permission_service.dart';
  export 'permission_guard.dart';
  export 'http_client.dart';

Example usage (lib/example/home_screen.dart):
  Shows: creating PermissionService with injected http client, calling init(), using
  PermissionGuard and calling hasPermission inline in a screen. Compatible with get_it DI.
  Comments explaining each step.

pubspec.yaml: include http (^1.1.0) and get_it (^7.6.0).

═══════════════════════════════════════════════
17. CONFIGURATION AND ENVIRONMENT
═══════════════════════════════════════════════

Backend .env.example (backend/.env.example):
  # Database
  MONGODB_URI=mongodb://localhost:27017/rbac_db

  # Server
  PORT=3000
  NODE_ENV=development
  LOG_LEVEL=info

  # RBAC (route prefix typically configured in RbacModule or main app)
  API_PREFIX=/api/rbac
  DEFAULT_ADMIN_ROLE=super-admin
  DEFAULT_USER_ROLE=user

  # Demo Auth (development only)
  DEMO_AUTH=false
  DEMO_USER_ID=demo-user-001

  # Redis (optional — leave unset to disable permission caching)
  # REDIS_URL=redis://localhost:6379
  # REDIS_CACHE_TTL_SECONDS=300

  # Rate limiting (NestJS @nestjs/throttler or similar)
  RATE_LIMIT_WINDOW_MS=900000
  RATE_LIMIT_MAX=100

  # RBAC seed — role assignment by email (comma-separated)
  SEED_SUPER_ADMIN_EMAILS=alice@example.com
  SEED_ADMIN_EMAILS=bob@example.com
  SEED_MANAGER_EMAILS=carol@example.com

Frontend .env.local.example (Next.js):
  # Backend origin only (e.g. http://localhost:5001). API client appends paths like /api/rbac.
  NEXT_PUBLIC_API_URL=http://localhost:5001
  NEXT_PUBLIC_DEMO_USER_ID=demo-user-001

  Note: NEXT_PUBLIC_API_URL must be the backend origin only. Restart the Next.js dev server
  after changing .env.local so the variable is picked up.

  Documentation (audit compliance/maintainability 9–10): Document API_PREFIX (backend) and
  NEXT_PUBLIC_API_URL (frontend) in README or .env.example comments so that deployment and
  cross-layer API consistency are clear. Example: "Backend runs on PORT; set
  NEXT_PUBLIC_API_URL=http://localhost:<PORT> in frontend .env.local. RBAC routes are at
  <API_PREFIX> (e.g. /api/rbac)."

═══════════════════════════════════════════════
18. PLACEHOLDERS (OPTIONAL)
═══════════════════════════════════════════════

When using this prompt with a template engine or agent:
- {{api_prefix}}               — base prefix for RBAC routes (e.g. /api/rbac).
- {{default_admin_role}}       — name of the seeded super-admin role (e.g. super-admin).
- {{default_user_role}}        — name of the default role assigned to all existing users
                                 during seeding and back-fill (e.g. user, member, viewer).
- {{cache_ttl_seconds}}        — Redis cache TTL in seconds (e.g. 300).
- {{max_roles_per_user}}       — optional: max roles a single user can hold (e.g. 10).
- {{frontend_url}}             — base URL for the Next.js app (e.g. http://localhost:3000).

Replace these with actual values for the target environment.

═══════════════════════════════════════════════
TARGET FILES (REFERENCE) — Current project layout
═══════════════════════════════════════════════

Project root: backend/ and frontend/ at repository root.

Backend (NestJS, backend/):
  Add:   backend/src/rbac/rbac.registry.ts       — permission constants and helpers
  Add:   backend/src/rbac/rbac.service.ts         — all RBAC business logic (incl. backfillDefaultRole, getUsersByRole)
  Add:   backend/src/rbac/rbac.controller.ts     — all RBAC HTTP endpoints (incl. /admin/backfill-default-role, /roles/:id/users)
  Add:   backend/src/rbac/guards/permissions-attachment.guard.ts  — attach permissions to request
  Add:   backend/src/rbac/guards/require-permission.guard.ts      — authorize by permission
  Add:   backend/src/rbac/decorators/require-permission.decorator.ts
  Add:   backend/src/rbac/rbac.seed.ts           — idempotent seeder + batched back-fill
  Add:   backend/src/rbac/rbac.cache.ts          — Redis cache layer (optional)
  Add:   backend/src/rbac/rbac.module.ts         — NestJS module wiring
  Add:   backend/src/rbac/dto/*.ts               — DTOs with class-validator (create-role, update-role, assign-role, etc.)
  Add:   backend/src/rbac/schemas/role.schema.ts        — Role Mongoose schema (incl. isDefault)
  Add:   backend/src/rbac/schemas/permission.schema.ts   — Permission Mongoose schema
  Add:   backend/src/rbac/schemas/user-role.schema.ts    — UserRole Mongoose schema (incl. isBackfilled)
  Add:   backend/src/common/lib/redis.ts         — optional ioredis client factory
  Add:   backend/src/common/interceptors/response.interceptor.ts   — success/error response shape
  Edit:  backend/src/app.module.ts               — import RbacModule; pass User model/schema for back-fill

Frontend (Next.js, frontend/) — Permission Layer:
  Add:   frontend/src/rbac/PermissionProvider.tsx  — context provider + fetch logic
  Add:   frontend/src/rbac/usePermission.ts       — hook reading from context (or Redux)
  Add:   frontend/src/rbac/PermissionGate.tsx     — conditional render component
  Add:   frontend/src/rbac/utils/wildcardMatcher.ts — wildcard matching (same algo as backend)
  Add:   frontend/src/rbac/index.ts               — barrel export
  Add:   frontend/src/lib/getApiError.ts          — optional: getApiErrorMessage(err) for consistent 403/401/user messages (audit code quality 9–10)
  Optional: frontend/src/store/slices/rbacSlice.ts — Redux slice if using Redux
  Edit:  frontend/src/app/layout.tsx              — wrap with PermissionProvider; add link to /rbac-admin if permitted

Frontend — RBAC Admin UI (Next.js App Router, frontend/src/app/rbac-admin/):
  Add:   frontend/src/app/rbac-admin/layout.tsx            — RbacAdminLayout (sidebar + children)
  Add:   frontend/src/app/rbac-admin/page.tsx               — redirect or overview
  Add:   frontend/src/app/rbac-admin/roles/page.tsx         — paginated roles table
  Add:   frontend/src/app/rbac-admin/roles/[id]/page.tsx    — role detail + edit + permissions + users
  Add:   frontend/src/app/rbac-admin/roles/CreateRoleModal.tsx
  Add:   frontend/src/app/rbac-admin/roles/ConfirmDeleteModal.tsx
  Add:   frontend/src/app/rbac-admin/permissions/page.tsx   — read-only permissions table
  Add:   frontend/src/app/rbac-admin/users/page.tsx         — user lookup + role assignment
  Add:   frontend/src/app/rbac-admin/settings/page.tsx      — default role + back-fill UI
  Add:   frontend/src/app/rbac-admin/components/*.tsx       — RbacTable, RbacPagination, RbacModal, RbacSearchInput, RbacToast, RbacBadge, AccessDenied
  Add:   frontend/src/app/rbac-admin/utils/rbacApi.ts       — API client with auth + envelope parsing
  Optional: frontend/src/store/slices/rolesSlice.ts, permissionsSlice.ts, userRolesSlice.ts (if using Redux)

Flutter (Mobile):
  Add:   lib/rbac/permission_service.dart   — PermissionService class
  Add:   lib/rbac/permission_guard.dart     — PermissionGuard widget
  Add:   lib/rbac/http_client.dart          — abstract HttpClient + default impl
  Add:   lib/rbac/rbac_exports.dart         — barrel export
  Add:   lib/example/home_screen.dart       — demo usage screen
  Edit:  lib/main.dart                      — DI setup; inject PermissionService
  Edit:  pubspec.yaml                       — add http, get_it dependencies

Backend Unit Tests:
  Add:   backend/src/rbac/*.spec.ts         — Jest; mock Mongoose (getModelToken)
  Add:   backend/src/rbac/rbac.registry.spec.ts, rbac.service.spec.ts, rbac.seed.spec.ts, rbac.cache.spec.ts
  Add:   backend/src/rbac/utils/regex-escape.spec.ts — escapeForRegex (search escaping for listRoles/listPermissions)
  Add:   backend/src/rbac/guards/*.spec.ts — RequirePermissionGuard, PermissionsAttachmentGuard
  Add:   backend/jest.rbac.config.js       — (optional) RBAC-only coverage config and threshold
  Add:   backend/test/jest-e2e.json        — e2e config if needed
  Edit:  backend/package.json              — test scripts (test, test:watch, test:cov, test:rbac, test:rbac:cov, test:e2e)

Frontend Unit Tests:
  Add:   frontend/src/rbac/__tests__/usePermission.test.ts
  Add:   frontend/src/rbac/__tests__/PermissionGate.test.tsx
  Add:   frontend/src/rbac/__tests__/PermissionProvider.test.tsx
  Optional: frontend/src/store/slices/__tests__/rbacSlice.test.ts, rolesSlice.test.ts (if using Redux)

═══════════════════════════════════════════════
SINGLE-RUN CHECKLIST (verify before considering implementation complete)
═══════════════════════════════════════════════

- [ ] PermissionGate: named import only (import { PermissionGate } from '@/rbac'); no default import.
- [ ] List API: listRoles/listPermissions return { data: T[], meta }; list pages use res.data and res.meta.
- [ ] Default "user" role includes user:view-permissions so GET /users/:id/permissions works for current user.
- [ ] Seed assigns roles by email via SEED_SUPER_ADMIN_EMAILS, SEED_ADMIN_EMAILS, SEED_MANAGER_EMAILS.
- [ ] Frontend NEXT_PUBLIC_API_URL set to backend origin; dev server restarted after .env.local change.
- [ ] Roles and permissions list pages: defensive (list ?? []).map in render; set list only when Array.isArray(res?.data).
- [ ] Mongoose: no duplicate unique index on Role name or Permission code (use @Prop({ unique: true }) only).
- [ ] getUserPermissions: when role.permissions are populated (documents), use p._id / p.code correctly.
- [ ] Backend listRoles/listPermissions escape search before $regex (ReDoS/injection — audit A05; Section 7 and 12).
- [ ] Backend listRoles/listPermissions use .lean() for read-only list queries (audit query_optimization).
- [ ] Shared getApiErrorMessage (or equivalent) used in RBAC admin catch blocks (audit code quality).
- [ ] RBAC seed-runner checks NODE_ENV and exits (or refuses) in production (audit Database; Section 9).
- [ ] README or .env.example documents API_PREFIX and NEXT_PUBLIC_API_URL (audit compliance).
- [ ] Frontend and backend RBAC test suites exist; npm test passes with coverage thresholds (audit 9–10).
- [ ] Backend Jest coverageThreshold enforced for src/rbac/** (e.g. 90% target; minimum 75% lines / 68% branches acceptable when using RBAC-only config until seed/cache/controller specs added; Section 15).

End of specification.

═══════════════════════════════════════════════
ALIGNMENT WITH MERN_AUDIT & GAP ANALYSIS
═══════════════════════════════════════════════

When targeting production readiness and audit score 9–10, use the gap analysis document to
verify implementation and audit coverage: prompts/RBAC_Production_Readiness_Gap_Analysis.md.
It maps this prompt and MERN_AUDIT.md to concrete checks (search escaping, .lean(), 
getApiErrorMessage, seed NODE_ENV, coverage threshold, rate limit docs, API_PREFIX/NEXT_PUBLIC_API_URL).
Implementers should fix gaps in the recommended order; auditors should verify each item
in Phase 3E (RBAC Production Readiness) of MERN_AUDIT.md where applicable.
