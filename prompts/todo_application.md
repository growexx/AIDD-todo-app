# Full-Stack Todo App — NestJS + Next.js

You are a senior full-stack developer. Build a production-grade Todo application in a single uninterrupted run. Every command must execute non-interactively. Never wait for manual input.

Stack:
- Backend: NestJS (latest) + MongoDB + Mongoose — folder name `backend`
- Frontend: Next.js (latest, App Router, TypeScript, Tailwind) — folder name `frontend`
- Auth: JWT — no registration UI, login only with seeded users
- Tests: Jest unit tests (backend)
- Docs: Swagger/OpenAPI (backend)

---

## PHASE 0 — OS DETECTION AND PREREQUISITES

Detect the OS at the very start. Store it. Use the correct shell commands throughout every phase:
- macOS/Linux: `mkdir -p`, `which`, `&` for background processes, `curl`, forward slashes
- Windows PowerShell: `New-Item -ItemType Directory -Force -Path`, `where`, `Start-Process`, `Invoke-WebRequest`, backslashes

**macOS/Linux:**
```
which node && which npm && node --version && npm --version
```
**Windows:**
```
where node; where npm; node --version; npm --version
```

Node.js must be v22 LTS. npm must be v10+. If either is missing or too old, stop and tell the user to install Node.js 22 LTS from https://nodejs.org.

---

## PHASE 1 — INSTALL NESTJS CLI

```
npm install -g @nestjs/cli
```

Confirm `nest --version` outputs a version number before continuing.

---

## PHASE 2 — SCAFFOLD BOTH PROJECTS

### CRITICAL SCAFFOLDING RULE
The two scaffold commands MUST be run from DIFFERENT working directories to prevent `create-next-app` from detecting NestJS files and refusing to run. Follow these steps exactly in this order:

**Step 1 — Create the root folder and scaffold the backend FROM the root folder's parent:**

macOS/Linux:
```
mkdir -p todo-app && cd todo-app && nest new backend --package-manager npm --skip-git
```
Windows:
```
New-Item -ItemType Directory -Force -Path todo-app; cd todo-app; nest new backend --package-manager npm --skip-git
```

Wait until `nest new backend` fully completes and `todo-app/backend/node_modules` exists before continuing.

**Step 2 — Scaffold the frontend in a COMPLETELY SEPARATE temp location, then move it:**

macOS/Linux:
```
cd /tmp && npx create-next-app@latest todo-frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```
Windows:
```
cd $env:TEMP; npx create-next-app@latest todo-frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

Wait until `create-next-app` fully completes, then move it into the project root:

macOS/Linux:
```
mv /tmp/todo-frontend /path/to/todo-app/frontend
```
Windows:
```
Move-Item "$env:TEMP\todo-frontend" "todo-app\frontend"
```

Replace `/path/to/todo-app` with the actual absolute path of the `todo-app` directory created in Step 1.

Confirm BOTH of these exist before continuing:
- `todo-app/backend/node_modules`
- `todo-app/frontend/node_modules`

If either is missing, re-run the install in the missing folder with `npm install` before continuing.

---

## PHASE 3 — BACKEND DEPENDENCIES

From `todo-app/backend`, install all at once:
```
npm install @nestjs/mongoose mongoose @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/config @nestjs/swagger swagger-ui-express bcryptjs helmet class-validator class-transformer @nestjs/throttler express-mongo-sanitize compression
```
```
npm install --save-dev @types/bcryptjs @types/passport-jwt @types/compression ts-node tsconfig-paths mongodb-memory-server
```

Confirm `node_modules` exists before continuing.

---

## PHASE 4 — FRONTEND DEPENDENCIES

From `todo-app/frontend`:
```
npm install axios react-hot-toast
```

Confirm `node_modules` exists before continuing.

Create `todo-app/frontend/.env.local.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Create `todo-app/frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## PHASE 5 — ENVIRONMENT FILES

Create `todo-app/backend/.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/todoapp
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

Create `todo-app/backend/.env.example` with the same keys but all values empty.

---

## PHASE 6 — BACKEND SOURCE FILES

Create every file completely. No TODOs, no placeholders, no omissions. All TypeScript with full typing. No `any` types. JSDoc on every exported class and public method.

---

### CRITICAL DESIGN DECISIONS — READ BEFORE WRITING ANY FILE

These rules exist to prevent the exact TypeScript errors and runtime failures that occur when these patterns are not followed:

**Rule A — JWT `expiresIn` type**
The `@nestjs/jwt` package's `JwtSignOptions.expiresIn` expects type `string | number`. In `JwtModule.registerAsync` and in `jwtService.sign()`, always cast the value with `as string`:
```typescript
expiresIn: configService.get('JWT_EXPIRES_IN') as string
```
Never import `StringValue` from `jsonwebtoken`. Never import `SignOptions` from `jsonwebtoken`. The `as string` cast is all that is needed.

**Rule B — NestJS Module wiring (`inject` vs `imports`)**
When using `useFactory` with `ConfigService` inside `registerAsync`, `ConfigService` belongs in `inject`, NEVER in `imports`. The `imports` array only accepts NestJS module classes. Example:
```typescript
JwtModule.registerAsync({
  inject: [ConfigService],          // ← ConfigService goes here
  useFactory: (config: ConfigService) => ({
    secret: config.get('JWT_SECRET') as string,
    signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') as string },
  }),
})
```

**Rule C — Health endpoint without @nestjs/terminus**
Do NOT use `@nestjs/terminus` or `@nestjs/axios` for the health endpoint. They introduce transitive dependency issues. Instead, create a simple `HealthController` that manually returns `{ status: 'ok', timestamp }`. Register it in `AppModule`. No special packages needed.

**Rule D — Mongoose service methods (for easy unit testing)**
- Use `this.todoModel.create(data)` — never `new this.todoModel(data)`
- Use `this.todoModel.find(filter, null, { sort: { createdAt: -1 } })` — never `find().sort()`
- Use `this.todoModel.findOneAndDelete({ _id: id, user: userId })` — never `deleteOne().exec()`
- Use `findOne()` then `.save()` for updates and toggle
- Never use `.exec()` anywhere

**Rule E — Mongoose pre-save hook**
Always write pre-save hooks as:
```typescript
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  // ...
});
```
Not an arrow function. No `next` parameter.

**Rule F — `UserDocument` must include instance methods**
When defining `UserDocument`, extend the Mongoose Document type AND include any schema instance methods:
```typescript
export type UserDocument = User & Document & {
  comparePassword(candidate: string): Promise<boolean>;
};
```
Without this, `user.comparePassword()` causes a TypeScript error in `AuthService`.

---

### `todo-app/backend/src/app.module.ts`

Root NestJS module:
- Import `ConfigModule.forRoot({ isGlobal: true })`
- Import `MongooseModule.forRootAsync` — inject `ConfigService`, read `MONGODB_URI`, set connection options: `serverSelectionTimeoutMS: 10000`, `retryWrites: true`, `retryReads: true`
- Import `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` for rate limiting
- Import `AuthModule`, `TodosModule`
- Import and declare `HealthController` directly in this module (see Rule C)

---

### `todo-app/backend/src/health.controller.ts`

Simple controller at route `/api/health` with a single `GET /` method that returns `{ status: 'ok', timestamp: new Date().toISOString() }`. No imports from `@nestjs/terminus`. Just `@Controller`, `@Get`, `@nestjs/common`.

---

### `todo-app/backend/src/common/filters/http-exception.filter.ts`

Global `@Catch()` exception filter `AllExceptionsFilter`:
- For `HttpException` instances: extract status and message, return `{ success: false, statusCode, message, timestamp, path }`
- For all other errors: return status 500 with `{ success: false, statusCode: 500, message: 'Internal server error', timestamp, path }`
- Log all errors using NestJS `Logger`

---

### `todo-app/backend/src/common/interceptors/response.interceptor.ts`

Global `ResponseInterceptor` implementing `NestInterceptor` that wraps every non-error response in `{ success: true, data: <original>, timestamp: new Date().toISOString() }`.

---

### `todo-app/backend/src/auth/schemas/user.schema.ts`

Mongoose `User` schema and document type.

Schema fields: `name` (String, required, trim, minlength 2, maxlength 50), `email` (String, required, unique, lowercase, trim), `password` (String, required, `select: false`), `createdAt` (Date, default Date.now).

Pre-save hook — follow Rule E exactly.

Instance method `comparePassword(candidate: string): Promise<boolean>` returning `bcrypt.compare(candidate, this.password)`.

Export `UserSchema`. Export `UserDocument` type following Rule F — must include `comparePassword` in the type definition.

---

### `todo-app/backend/src/auth/dto/login.dto.ts`

`LoginDto` class with `email` (`@IsEmail()`, `@IsNotEmpty()`, `@ApiProperty()`) and `password` (`@IsString()`, `@IsNotEmpty()`, `@ApiProperty()`). Use plain ASCII strings in decorator arguments — no apostrophes in description strings.

---

### `todo-app/backend/src/auth/strategies/jwt.strategy.ts`

`JwtStrategy` extending `PassportStrategy(Strategy)`:
- `jwtFromRequest`: `ExtractJwt.fromAuthHeaderAsBearerToken()`
- `ignoreExpiration`: false
- `secretOrKey`: `configService.get<string>('JWT_SECRET')`
- `validate(payload)` returns `{ userId: payload.sub, email: payload.email }`

---

### `todo-app/backend/src/auth/guards/jwt-auth.guard.ts`

`JwtAuthGuard` extending `AuthGuard('jwt')`. No additional logic.

---

### `todo-app/backend/src/auth/auth.service.ts`

Injectable `AuthService`. Inject `@InjectModel(User.name) private userModel: Model<UserDocument>` and `JwtService`.

**`validateUser(email: string, password: string): Promise<UserDocument | null>`**:
- Find user: `this.userModel.findOne({ email }).select('+password')`
- If not found, return null
- Call `user.comparePassword(password)` — if false, return null
- Return user

**`login(user: UserDocument)`**:
- Build payload: `{ email: user.email, sub: user._id.toString() }`
- Sign: `this.jwtService.sign(payload, { expiresIn: this.configService.get('JWT_EXPIRES_IN') as string })`
- Return `{ access_token, user: { id: user._id.toString(), name: user.name, email: user.email } }`

Follow Rule A for `expiresIn`.

---

### `todo-app/backend/src/auth/auth.module.ts`

NestJS module:
- `MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])`
- `PassportModule`
- `JwtModule.registerAsync` — follow Rule B exactly: `inject: [ConfigService]`, no `ConfigService` in `imports`
- Provides `AuthService`, `JwtStrategy`
- Exports `AuthService`, `JwtModule`

---

### `todo-app/backend/src/todos/schemas/todo.schema.ts`

Mongoose `Todo` schema using `@Schema({ timestamps: true })` — this auto-manages `createdAt` and `updatedAt` (do NOT add `@Prop` for them, and do NOT add a pre-save hook for `updatedAt`):
- `title`: String, required, trim, minlength 1, maxlength 200
- `description`: String, trim, maxlength 1000, default empty string
- `completed`: Boolean, default false
- `priority`: String, enum `['low', 'medium', 'high']`, default `'medium'`
- `dueDate`: Date, optional. Add a Mongoose custom validator that computes `todayMidnight` by taking `new Date()` and setting its hours, minutes, seconds, and milliseconds all to zero, then rejects if the incoming date value is strictly less than `todayMidnight`
- `user`: ObjectId, ref `'User'`, required

After the schema definition, add a **compound index** for performance:
```typescript
TodoSchema.index({ user: 1, createdAt: -1 });
```

Export `TodoSchema` and `TodoDocument` type.

---

### `todo-app/backend/src/todos/dto/create-todo.dto.ts`

`CreateTodoDto`: `title` (`@IsString`, `@IsNotEmpty`, `@MinLength(1)`, `@MaxLength(200)`, `@Transform(({ value }) => value.trim())`, `@ApiProperty`), `description` (`@IsOptional`, `@IsString`, `@MaxLength(1000)`, `@ApiPropertyOptional`), `priority` (`@IsOptional`, `@IsIn(['low','medium','high'])`, `@ApiPropertyOptional`), `dueDate` (`@IsOptional`, `@IsDateString`, `@ApiPropertyOptional`).

---

### `todo-app/backend/src/todos/dto/update-todo.dto.ts`

`UpdateTodoDto` using `PartialType(CreateTodoDto)`. Add `completed` (`@IsOptional`, `@IsBoolean`, `@ApiPropertyOptional`).

---

### `todo-app/backend/src/todos/types/todo-query.interface.ts`

Extract the shared query interface here (do NOT duplicate it in controller and service):
```typescript
export interface TodoQuery {
  search?: string;
  completed?: string;
  priority?: string;
  page?: string;
  limit?: string;
}
```

---

### `todo-app/backend/src/todos/todos.service.ts`

Injectable `TodosService`. Inject `@InjectModel(Todo.name) private todoModel: Model<TodoDocument>`.

Follow Rule D — no chaining, no `.exec()`, no `new this.todoModel()`.

Private helper `isPastDate(dateStr: string): boolean`:
- Parse `dateStr` to a Date
- Create `todayMidnight = new Date()` then call `.setHours(0, 0, 0, 0)` on it
- Return `parsedDate < todayMidnight`

**`findAll(userId, query: TodoQuery)`** — import `TodoQuery` from `./types/todo-query.interface`:
- Build filter `{ user: userId }`
- If `query.search`: **escape the search string first** with `query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`, then add `$or: [{ title: { $regex: escapedSearch, $options: 'i' } }, { description: { $regex: escapedSearch, $options: 'i' } }]`
- If `query.completed === 'true'`: add `completed: true`; if `'false'`: add `completed: false`
- If `query.priority`: add `priority: query.priority`
- Parse pagination: `const page = Math.max(1, parseInt(query.page || '1', 10))`, `const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)))`, `const skip = (page - 1) * limit`
- Return `{ items: await this.todoModel.find(filter, null, { sort: { createdAt: -1 } }).skip(skip).limit(limit).lean<TodoDocument[]>(), total: await this.todoModel.countDocuments(filter), page, limit }`

**`create(userId, dto: CreateTodoDto)`**:
- If `dto.dueDate` and `isPastDate(dto.dueDate)`: throw `BadRequestException('Due date cannot be in the past')`
- Return `this.todoModel.create({ ...dto, user: userId })`

**`update(id, userId, dto: UpdateTodoDto)`**:
- If `!Types.ObjectId.isValid(id)`: throw `BadRequestException('Invalid ID format')`
- `const todo = await this.todoModel.findOne({ _id: id, user: userId })`
- If null: throw `NotFoundException('Todo not found')`
- If `dto.dueDate` and `isPastDate(dto.dueDate)`: throw `BadRequestException('Due date cannot be in the past')`
- Assign all defined fields from `dto` onto `todo`
- Set `todo.updatedAt = new Date()` then `await todo.save()`
- Return `todo`

**`delete(id, userId)`**:
- If `!Types.ObjectId.isValid(id)`: throw `BadRequestException('Invalid ID format')`
- `const deleted = await this.todoModel.findOneAndDelete({ _id: id, user: userId })`
- If `deleted` is null: throw `NotFoundException('Todo not found')`
- Return `{ message: 'Todo deleted successfully' }`

**`toggleComplete(id, userId)`**:
- If `!Types.ObjectId.isValid(id)`: throw `BadRequestException('Invalid ID format')`
- `const todo = await this.todoModel.findOne({ _id: id, user: userId })`
- If null: throw `NotFoundException('Todo not found')`
- Toggle `todo.completed`, set `todo.updatedAt = new Date()`, `await todo.save()`
- Return `todo`

---

### `todo-app/backend/src/todos/todos.controller.ts`

`@Controller('api/todos')`, `@UseGuards(JwtAuthGuard)`, `@ApiTags('Todos')`, `@ApiBearerAuth()`.

Import `TodoQuery` from `./types/todo-query.interface`.

All methods have `@ApiOperation`, `@ApiResponse({ status: 200 })`, and `@ApiResponse({ status: 401, description: 'Unauthorised' })`. User id from `req.user.userId`.

- `GET /` → `findAll(req, @Query() query: TodoQuery)` — supports `search`, `completed`, `priority`, `page`, `limit` query params
- `POST /` → `create(req, @Body() dto: CreateTodoDto)`
- `PATCH /:id` → `update(@Param('id') id, req, @Body() dto: UpdateTodoDto)` — use `@Patch` (partial update semantics, not `@Put`)
- `DELETE /:id` → `delete(@Param('id') id, req)`
- `PATCH /:id/toggle` → `toggleComplete(@Param('id') id, req)`

---

### `todo-app/backend/src/auth/auth.controller.ts`

`@Controller('api/auth')`, `@ApiTags('Auth')`.

- `POST /login` — apply `@UseGuards(ThrottlerGuard)` on this method to rate-limit login attempts (max 10 per 60 seconds). Has `@ApiOperation`, `@ApiResponse({ status: 200 })`, `@ApiResponse({ status: 401, description: 'Unauthorised' })`, `@ApiResponse({ status: 429, description: 'Too Many Requests' })`.
  - Calls `authService.validateUser(dto.email, dto.password)` — if null, throw `UnauthorizedException('Invalid email or password')`
  - Calls `authService.login(user)` and returns the result

---

`MongooseModule.forFeature` for Todo schema. Provides `TodosService`, declares `TodosController`.

---

### `todo-app/backend/src/database/seeder.ts`

Standalone seeder script. The very first executable line must be `require('dotenv').config()` — before any other require or import so env vars load before mongoose connects.

Steps:
1. **PRODUCTION GUARD — add this as the very first check after dotenv.config():**
   ```typescript
   if (process.env['NODE_ENV'] === 'production') {
     console.error('ERROR: Cannot run seeder in production environment! Aborting.');
     process.exit(1);
   }
   ```
2. Connect to `process.env.MONGODB_URI`
3. Delete all existing Users and Todos
4. Create these 3 users (let the pre-save hook hash the passwords — do not hash manually):

   | Name        | Email              | Password  |
   |-------------|--------------------|-----------|
   | Alice Smith | alice@todoapp.com  | Alice@123 |
   | Bob Johnson | bob@todoapp.com    | Bob@123   |
   | Carol White | carol@todoapp.com  | Carol@123 |

5. Create 3 sample todos for Alice: "Buy groceries" (low, not completed), "Finish project report" (high, not completed), "Call dentist" (medium, completed)
6. Print exactly:
```
==================================================
DATABASE SEEDED SUCCESSFULLY
==================================================
Default Users:
  Email: alice@todoapp.com  | Password: Alice@123
  Email: bob@todoapp.com    | Password: Bob@123
  Email: carol@todoapp.com  | Password: Carol@123
==================================================
Use these credentials to log in at http://localhost:3000
==================================================
```
7. Disconnect and call `process.exit(0)` on success, `process.exit(1)` on error

After creating this file, add the `"seed"` script to `todo-app/backend/package.json` by reading the current `package.json` content and inserting the seed script into the `"scripts"` section using a targeted string replacement. The seed script value is:
```
ts-node -r tsconfig-paths/register src/database/seeder.ts
```

---

### `todo-app/backend/src/main.ts`

Bootstrap the NestJS app:
- Create app with `AppModule`
- Apply `ValidationPipe` globally: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`
- Apply `AllExceptionsFilter` globally
- Apply `ResponseInterceptor` globally
- Apply `compression()` via `app.use(compression())` — **before helmet**
- Apply `helmet()` via `app.use(helmet())`
- Apply `mongoSanitize()` via `app.use(mongoSanitize())` — **after helmet** — import as `import mongoSanitize from 'express-mongo-sanitize'`
- Enable CORS: `origin: configService.get('CLIENT_URL') || 'http://localhost:3000'`, `credentials: true`
- **Conditionally** register Swagger only when `NODE_ENV !== 'production'`: title `'Todo API'`, version `'1.0'`, call `addBearerAuth()`, mount at `/api/docs`
- Listen on the port from `ConfigService`
- Use NestJS `Logger` (not `console.log`) for startup messages: `new Logger('Bootstrap').log('Application running on http://localhost:PORT')` and `new Logger('Bootstrap').log('Swagger docs at http://localhost:PORT/api/docs')`

Do NOT add any inline controller or `app.use()` handler for `/api/health` here. The health endpoint is handled by `HealthController` registered in `AppModule`.

---

## PHASE 7 — BACKEND UNIT TESTS

### TEST MOCKING RULES — MUST FOLLOW EXACTLY

**Rule T1 — Module setup:**
```typescript
const module = await Test.createTestingModule({
  providers: [
    TodosService,
    {
      provide: getModelToken(Todo.name),
      useValue: {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        findOneAndDelete: jest.fn(),
      },
    },
  ],
}).compile();
service = module.get<TodosService>(TodosService);
model = module.get<Model<TodoDocument>>(getModelToken(Todo.name));
```

**Rule T2 — Mock inside each test with `jest.spyOn`, not in `beforeEach`.**

**Rule T3 — Mock document from `findOne` must include `save: jest.fn()`:**
```typescript
const mockDoc = {
  _id: new Types.ObjectId(), title: 'Test', completed: false,
  user: userId, updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(undefined),
};
jest.spyOn(model, 'findOne').mockResolvedValue(mockDoc as any);
```

**Rule T4 — `afterEach(() => jest.clearAllMocks())` — never `beforeEach`.**

**Rule T5 — Never mock `.exec()`. No `.exec()` in service or tests.**

---

### `todo-app/backend/src/todos/todos.service.spec.ts`

Full Jest test suite for `TodosService` following all rules above.

Add a `createMockTodo()` helper at the top returning a plain object with `_id`, `title`, `description`, `completed`, `priority`, `dueDate`, `user`, `createdAt`, `updatedAt`, and `save: jest.fn().mockResolvedValue(undefined)`.

Tests:

**`findAll`**: returns list with pagination metadata; applies search filter (escaped `$or` in query); applies completed filter; applies priority filter.

**`create`**: creates and returns a todo; throws `BadRequestException` when `dueDate` is yesterday (do not mock `create` — it should never be called); throws `BadRequestException` when title is whitespace-only `'   '` (trimmed to empty).

**`update`**: updates and calls `save`; throws `NotFoundException` when `findOne` returns null; throws `BadRequestException` when `dueDate` is yesterday and `findOne` returns a valid doc; throws `BadRequestException` when `id` is not a valid MongoDB ObjectId (e.g., `'invalid-id'`).

**`delete`**: returns success message; throws `NotFoundException` when `findOneAndDelete` returns null; throws `BadRequestException` when `id` is not a valid MongoDB ObjectId.

**`toggleComplete`**: flips `false` to `true` and calls `save`; flips `true` to `false` and calls `save`; throws `BadRequestException` when `id` is not a valid MongoDB ObjectId.

---

### `todo-app/backend/src/auth/strategies/jwt.strategy.spec.ts`

Unit test for `JwtStrategy.validate()`:
- Mock `ConfigService` with `{ get: jest.fn().mockReturnValue('test-secret') }`
- Test: `validate({ sub: 'user123', email: 'a@b.com' })` returns `{ userId: 'user123', email: 'a@b.com' }`

---

### `todo-app/backend/src/todos/todos.controller.spec.ts`

Integration test for `TodosController` using `Test.createTestingModule` with mocked `TodosService`:
- Mock `JwtAuthGuard` with `{ canActivate: () => true }`
- Test that `GET /` calls `todosService.findAll` with correct userId from req.user
- Test that `POST /` calls `todosService.create`
- Test that `PATCH /:id` calls `todosService.update`
- Test that `DELETE /:id` calls `todosService.delete`
- Test that `PATCH /:id/toggle` calls `todosService.toggleComplete`

---

---

### `todo-app/backend/test/app.e2e-spec.ts`

**Do NOT import the real `AppModule` directly** — this would trigger a live MongoDB connection and break CI environments without a database.

Instead, use `mongodb-memory-server` to spin up an in-memory database:

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // use mongod.getUri() as the MONGODB_URI when bootstrapping the test app
});

afterAll(async () => {
  await app.close();
  await mongod.stop();
});
```

Include a test: `GET /api/health` expects HTTP 200 with `{ status: 'ok' }` in the response body (inside the `data` wrapper from `ResponseInterceptor`).

---

Full Jest test suite for `AuthService`.

Mock `getModelToken(User.name)` with `{ findOne: jest.fn() }`. Mock `JwtService` with `{ sign: jest.fn().mockReturnValue('mock-token') }`. Mock `ConfigService` with `{ get: jest.fn().mockReturnValue('7d') }`.

`mockUser` has `_id`, `name`, `email`, `password`, and `comparePassword: jest.fn()`.

`afterEach(() => jest.clearAllMocks())`.

**`validateUser`**: returns user when `findOne` returns a chainable `{ select: jest.fn().mockResolvedValue(mockUser) }` and `comparePassword` resolves `true`; returns `null` when user not found; returns `null` when password does not match.

**`login`**: returns object with `access_token` (string) and `user` with `id`, `name`, `email`.

---

## PHASE 8 — FRONTEND SOURCE FILES

All TypeScript. App Router, `src/` directory. `'use client'` on every component and page file.

---

### `todo-app/frontend/src/types/index.ts`

Interfaces: `User` (`id`, `name`, `email`), `Todo` (`id`, `title`, `description`, `completed`, `priority: 'low'|'medium'|'high'`, `dueDate: string|null`, `user`, `createdAt`, `updatedAt`), `LoginFormData` (`email`, `password`), `TodoFormData` (`title`, `description`, `priority: 'low'|'medium'|'high'`, `dueDate`).

Add a comment at the top: the backend wraps all responses via `ResponseInterceptor` as `{ success: true, data: T }`. So every `axios` call must access `response.data.data` to get the actual payload.

---

### `todo-app/frontend/src/lib/api.ts`

Axios instance — use `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'` as `baseURL` (never hardcode `localhost:5000`), `withCredentials: true`.

Request interceptor: attach `Authorization: Bearer <token>` from `localStorage.getItem('token')` if present.

Response interceptor: on 401, clear localStorage and set `window.location.href = '/login'`.

Export as default.

---

### `todo-app/frontend/src/lib/auth.ts`

Helper functions with JSDoc: `getToken()`, `setAuth(token, user)`, `clearAuth()`, `getUser(): User | null`, `isAuthenticated(): boolean`.

---

### `todo-app/frontend/src/context/AuthContext.tsx`

`'use client'` at top. Context with `AuthProvider`. State: `user: User|null`, `token: string|null`, `isAuthenticated: boolean`. Initialize from `getUser()` and `getToken()`. Methods: `login(token, user)` calls `setAuth` and updates state. `logout()` calls `clearAuth` and resets state. Export both `AuthContext` (named) and `AuthProvider` (named).

---

### `todo-app/frontend/src/hooks/useAuth.ts`

`'use client'` at top. `useAuth()` returns `useContext(AuthContext)`. If context is null, throw a descriptive error.

---

### `todo-app/frontend/src/app/layout.tsx`

Root layout. Import `AuthProvider` from context. Import `Toaster` from `react-hot-toast`. Wrap `{children}` in `AuthProvider`. Render `<Toaster position="top-right" />` inside the body. Import global CSS. `lang="en"`.

---

### `todo-app/frontend/src/app/page.tsx`

Calls `redirect('/login')` from `next/navigation`. No `'use client'` needed on this file.

---

### `todo-app/frontend/src/app/login/page.tsx`

`'use client'`. Controlled form with `email` and `password`. On submit POST to `/api/auth/login`.

The backend (via `ResponseInterceptor`) returns `{ success: true, data: { access_token, user } }`. Access the token and user as `response.data.data.access_token` and `response.data.data.user`.

Call `login(access_token, user)` from `useAuth`, then `router.push('/dashboard')`.

Show a credentials hint block below the form:
```
alice@todoapp.com / Alice@123
bob@todoapp.com   / Bob@123
carol@todoapp.com / Carol@123
```

Show loading spinner in button while submitting. Display server error messages inline. Style with Tailwind.

---

### `todo-app/frontend/src/app/dashboard/page.tsx`

`'use client'`. Add hydration guard:
```typescript
const [hydrated, setHydrated] = useState(false);
useEffect(() => setHydrated(true), []);
if (!hydrated) return null; // prevent SSR flash
```

Check `isAuthenticated` inside the debounced `useEffect` — if false, call `router.push('/login')`. **Do NOT use a separate `useEffect` just for the redirect** — this causes a double fetch on mount.

On mount, fetch `GET /api/todos`. Response is `{ success: true, data: { items: Todo[], total: number } }` — access as `response.data.data.items`.

State: `todos: Todo[]`, `loading: boolean`, `submitting: boolean`, `search: string`, `filterCompleted: string`, `filterPriority: string`, `showForm: boolean`, `editingTodo: Todo|null`.

**Single debounced `useEffect` for all fetches** (400ms debounce):
```typescript
useEffect(() => {
  if (!isAuthenticated) {
    router.push('/login');
    return;
  }
  const timer = setTimeout(() => {
    fetchTodos({ search, completed: filterCompleted, priority: filterPriority });
  }, 400);
  return () => clearTimeout(timer);
}, [isAuthenticated, search, filterCompleted, filterPriority]);
```
Do not add a second separate `useEffect` for initial load — this single effect handles both.

CRUD handlers update `todos` state in place (no full re-fetch). Each shows `toast.success` or `toast.error`.

Layout: `<Navbar />`, dashboard header (title + Add Todo button), filter bar (`SearchBar` + two filter selects), stats row (total/completed/pending), conditional `TodoForm` for create, conditional `TodoForm` for edit, list of `TodoCard` components.

---

### `todo-app/frontend/src/components/Navbar.tsx`

`'use client'`. App name left, logged-in user name + Logout button right. Logout calls `logout()` from `useAuth` then `router.push('/login')`. Tailwind.

---

### `todo-app/frontend/src/components/TodoCard.tsx`

`'use client'`. Props: `todo: Todo`, `onToggle`, `onEdit`, `onDelete`. Show: title (strikethrough when completed), description, priority badge (green/amber/red), due date if present, created date, toggle/edit/delete buttons. Tailwind.

**Wrap with `React.memo`**: `export default React.memo(TodoCard)` — prevents unnecessary re-renders when other todos or unrelated state changes.

---

### `todo-app/frontend/src/components/TodoForm.tsx`

`'use client'`. Props: `onSubmit: (data: TodoFormData) => void`, `onCancel: () => void`, `initialData?: Partial<TodoFormData & { id?: string }>`, `loading: boolean`.

Fields: title (required), description (optional textarea), priority select, dueDate date input.

The `dueDate` input: set its `min` attribute to `new Date().toISOString().split('T')[0]` so the browser blocks past dates. Also validate on submit: if `dueDate` is provided and is before today, show inline error `"Due date cannot be in the past"` and do not call `onSubmit`.

Button label: "Add Todo" if no `initialData?.id`, otherwise "Update Todo". Tailwind.

---

### `todo-app/frontend/src/components/SearchBar.tsx`

`'use client'`. Props: `value: string`, `onChange: (v: string) => void`, `placeholder?: string`. Search input with magnifier icon. Tailwind.

---

## PHASE 9 — GITIGNORE FILES AND README

Create `todo-app/.gitignore` (root level) with: `node_modules`, `dist`, `.env`, `.env.local`, `.next`, `coverage`

Create `todo-app/backend/.gitignore` with: `node_modules`, `dist`, `.env`, `coverage`

Create `todo-app/frontend/.gitignore` with: `node_modules`, `.next`, `.env.local`, `coverage`

Create `todo-app/README.md` with:
- Project overview (NestJS + Next.js + MongoDB Todo App)
- Prerequisites (Node.js 22 LTS, MongoDB)
- Environment setup instructions (copy `.env.example` to `.env` in backend, copy `.env.local.example` to `.env.local` in frontend)
- Installation commands for both `backend/` and `frontend/`
- Development server commands (`npm run start:dev` for backend, `npm run dev` for frontend)
- Seeding instructions with a **⚠️ WARNING: never run seed against production** note
- Test commands (`npm run test` in backend)
- Default login credentials table

---

## PHASE 10 — SELF-REVIEW

Before running any build, read each file and verify:

1. `AppModule` imports `HealthController` in its `controllers` array (not as a module), imports `ThrottlerModule`, and does NOT import `ConfigService` anywhere in its `imports` array
2. `auth.module.ts`: `ConfigService` is in `inject`, NOT in `imports` of `JwtModule.registerAsync`
3. `auth.service.ts`: `expiresIn` cast is `configService.get('JWT_EXPIRES_IN') as string` — no `StringValue`, no jsonwebtoken type import
4. `user.schema.ts`: `UserDocument` type includes `comparePassword` in its definition (Rule F)
5. `todos.service.ts`: no `new this.todoModel()`, no `.exec()`, no `.find().sort()` chains; regex search is escaped; `findAll` returns `{ items, total, page, limit }`; `update/delete/toggleComplete` each start with `Types.ObjectId.isValid(id)` check
6. `todos.service.spec.ts`: `afterEach(jest.clearAllMocks)` not `beforeEach`, no `.exec()` mocks
7. `login/page.tsx`: reads `response.data.data.access_token`
8. `dashboard/page.tsx`: reads `response.data.data.items` for todos array; has single debounced `useEffect` (not two); has hydration guard
9. `AuthContext.tsx`: has `'use client'` at top, exports `AuthContext` as named export
10. `TodoForm.tsx`: `dueDate` input has `min` attribute and past-date validation on submit
11. `health.controller.ts` exists and is imported in `AppModule` — no `@nestjs/terminus`, no `@nestjs/axios`
12. `main.ts`: uses `compression()` before `helmet()`, uses `mongoSanitize()` after `helmet()`, Swagger registered only when `NODE_ENV !== 'production'`, uses `new Logger('Bootstrap')` not `console.log`
13. `todo.schema.ts`: uses `@Schema({ timestamps: true })`, no manual `createdAt`/`updatedAt` props, has `TodoSchema.index({ user: 1, createdAt: -1 })`
14. `auth.controller.ts`: login endpoint has `@UseGuards(ThrottlerGuard)`, has `@ApiResponse({ status: 429 })`
15. `todos.controller.ts`: update endpoint uses `@Patch` (not `@Put`), imports `TodoQuery` from types file, all endpoints have `@ApiResponse({ status: 401 })`
16. `api.ts` (frontend): uses `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'` — no hardcoded localhost
17. `seeder.ts`: has `NODE_ENV === 'production'` guard as the very first check
18. `TodoCard.tsx`: exported with `React.memo`
19. `todo-query.interface.ts` exists and is imported in both controller and service (not duplicated)
20. `jwt.strategy.spec.ts` exists with a test for `validate()`
21. `todos.controller.spec.ts` exists with controller integration tests
22. Root `todo-app/.gitignore` exists
23. `todo-app/README.md` exists
24. No file has TODO comments, incomplete blocks, or missing imports

Fix every issue before proceeding to Phase 11.

---

## PHASE 11 — BACKEND BUILD

From `todo-app/backend`:
```
npm run build
```

If it fails, read every TypeScript error carefully. Fix the source files. Re-run. Repeat until the build passes with zero errors. Do not proceed until clean.

---

## PHASE 12 — BACKEND TESTS

From `todo-app/backend`:
```
npm run test
```

All tests must pass. If any fail, fix only the failing test or the service method it tests. Do not rewrite entire spec files. Repeat until all tests are green. Do not proceed until clean.

---

## PHASE 13 — FRONTEND BUILD

From `todo-app/frontend`:
```
npm run build
```

If it fails, fix all TypeScript and Next.js errors. Re-run until clean. Do not proceed until clean.

---

## PHASE 14 — SEED DATABASE

From `todo-app/backend`:
```
npm run seed
```

The credentials table must be printed. If it fails because MongoDB is not running, report that to the user and stop.

---

## PHASE 15 — START SERVERS

**macOS/Linux:**
```
cd todo-app/backend && npm run start:dev &
cd todo-app/frontend && npm run dev &
```
**Windows:**
```
Start-Process npm -ArgumentList "run","start:dev" -WorkingDirectory "todo-app\backend" -PassThru
Start-Process npm -ArgumentList "run","dev" -WorkingDirectory "todo-app\frontend" -PassThru
```

Health check after servers start:

**macOS/Linux:** `curl http://localhost:5000/api/health`
**Windows:** `Invoke-WebRequest -Uri http://localhost:5000/api/health -UseBasicParsing`

On success print:
```
=====================================================
TODO APP IS READY
=====================================================
Backend API:   http://localhost:5000
Swagger Docs:  http://localhost:5000/api/docs
Frontend App:  http://localhost:3000

Default Login Credentials:
  alice@todoapp.com  | Alice@123
  bob@todoapp.com    | Bob@123
  carol@todoapp.com  | Carol@123
=====================================================
```

If health check fails, read the backend process output and identify the exact startup error before reporting it.

---

## TECH AUDIT CHECKLIST

Verify before declaring done:

**Security:**
- [ ] `helmet()` in `main.ts`
- [ ] `compression()` before `helmet()` in `main.ts`
- [ ] `express-mongo-sanitize` (`mongoSanitize()`) after `helmet()` in `main.ts`
- [ ] `JwtAuthGuard` on all todo routes
- [ ] `ThrottlerGuard` on `POST /api/auth/login` (max 10 req/60s)
- [ ] Passwords bcrypt hashed (saltRounds 12), never in responses
- [ ] CORS restricted to `CLIENT_URL`
- [ ] `.env` in `.gitignore` (backend, frontend, and root)
- [ ] No hardcoded secrets
- [ ] Swagger registered only when `NODE_ENV !== 'production'`
- [ ] Seeder has `NODE_ENV === 'production'` guard that exits immediately

**Code Quality:**
- [ ] `AllExceptionsFilter` handles all error shapes consistently
- [ ] `ResponseInterceptor` wraps all success responses
- [ ] No `any` types
- [ ] All endpoints have `@ApiOperation`, `@ApiResponse(200)`, and `@ApiResponse(401)`
- [ ] JSDoc on all exported classes and public methods
- [ ] `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- [ ] NestJS `Logger` used, not `console.log`
- [ ] `TodoQuery` interface defined once in `todo-query.interface.ts` — imported, not duplicated
- [ ] `@Schema({ timestamps: true })` used — no manual `updatedAt` management
- [ ] Compound index `{ user: 1, createdAt: -1 }` on Todo schema
- [ ] `$regex` search string is escaped before use

**Testing:**
- [ ] All `TodosService` and `AuthService` tests pass
- [ ] `jwt.strategy.spec.ts` exists with validate() test
- [ ] `todos.controller.spec.ts` exists with controller integration tests
- [ ] E2E test uses `mongodb-memory-server` (no live DB in tests)
- [ ] Edge cases tested: invalid ObjectId, whitespace title, past dueDate
- [ ] No real DB calls in unit tests
- [ ] No `.exec()` in tests or service

**Frontend:**
- [ ] TypeScript throughout, no `any`
- [ ] `api.ts` uses `process.env.NEXT_PUBLIC_API_URL` (not hardcoded)
- [ ] `frontend/.env.local.example` exists with `NEXT_PUBLIC_API_URL`
- [ ] `dashboard/page.tsx` uses single debounced `useEffect` with `isAuthenticated` guard (no separate redirect effect)
- [ ] `dashboard/page.tsx` has hydration guard to prevent SSR flash
- [ ] `response.data.data.items` used for todos array
- [ ] Past due dates blocked in UI and on submit
- [ ] Credentials hint on login page
- [ ] `TodoCard` wrapped with `React.memo`

**API:**
- [ ] RESTful endpoints — update uses `PATCH`, not `PUT`
- [ ] All `PATCH/DELETE` endpoints validate ObjectId format before DB call
- [ ] `findAll` returns paginated `{ items, total, page, limit }` shape
- [ ] Todos scoped per user
- [ ] Swagger at `/api/docs` (dev only)
- [ ] `/api/health` returns `{ status: 'ok' }`

**DevOps / Maintainability:**
- [ ] Root `todo-app/.gitignore` exists
- [ ] `todo-app/README.md` exists with setup, seed warning, and test instructions

---

## RULES

- Detect OS first. Never mix shell syntax.
- All commands run non-interactively. No manual input ever.
- After every `npm install`, confirm `node_modules` exists.
- After creating every file, confirm it was written successfully.
- Phases 11 → 12 → 13 → 14 → 15 run in order. No skipping.
- If a build or test fails, fix the specific error and retry. Do not rewrite whole files unless necessary.
- The app must open at `http://localhost:3000` and be fully usable with the seeded credentials.
