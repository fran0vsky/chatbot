# NestJS Backend Rules

## Structure
- Every feature gets its own module (e.g. `AgentsModule`)
- Controllers handle HTTP only — no business logic
- Business logic lives in services
- One responsibility per class

## Dependency Injection
- Always inject dependencies via the constructor — never instantiate classes with `new` inside other classes
- Mark services as `@Injectable()` and register them in their module's `providers` array

## Types
- Import shared request/response types from `@org/shared-types`
- No `any` — use proper types or `unknown`
- No unused variables

## Logging
- Use NestJS `Logger` class — never use `console.log`
- Inject logger as: `private readonly logger = new Logger(ClassName.name)`

## Error Handling
- Throw NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Never let raw errors bubble up to the client

## Environment Variables
- Always read env vars via `process.env['VAR_NAME']`
- Document every new env var in `.env.example`
