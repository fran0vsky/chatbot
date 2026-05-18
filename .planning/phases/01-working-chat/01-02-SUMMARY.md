---
phase: 01-working-chat
plan: 02
status: complete
completed: 2026-05-18
requirements: [UI-01, UI-02, UI-03, UI-04, CONV-01, CONV-02]
---

# Plan 01-02 Summary — Angular Chat UI

## Component tree

```
App                          apps/frontend/src/app/app.ts (selector: app-root)
└── ChatComponent            apps/frontend/src/app/chat/chat.ts (selector: app-chat)
    └── MessageBubble        apps/frontend/src/app/chat/message-bubble/message-bubble.ts (selector: app-message-bubble)
```

All three are standalone components with `ChangeDetectionStrategy.OnPush`. `NxWelcome` and its spec file are deleted.

## ChatService

```ts
@Injectable({ providedIn: 'root' })
class ChatService {
  private readonly http = inject(HttpClient);
  readonly threadId = crypto.randomUUID();
  sendMessage(message: string): Observable<ChatResponse>
}
```

Request shape: `POST ${environment.apiUrl}/api/agents/chat` with body `{ message, threadId }`. Types imported from `@org/shared-types`.

Uses `inject()` function instead of constructor injection (forced by `@angular-eslint/prefer-inject`).

## Environments + fileReplacements

- `apps/frontend/src/environments/environment.ts` → `apiUrl: 'http://localhost:3000'`
- `apps/frontend/src/environments/environment.prod.ts` → `apiUrl: 'https://YOUR_CLOUD_RUN_URL'` (placeholder; overwritten during Plan 03 human setup)
- `apps/frontend/project.json` `targets.build.configurations.production.fileReplacements` swaps the two files for production builds.

## tsconfig fix

The shared root `tsconfig.base.json` is backend-oriented (`emitDeclarationOnly: true`, `lib: ["es2022"]` only). Both `apps/frontend/tsconfig.app.json` and `tsconfig.spec.json` now override:

- `lib: ["es2022", "dom", "dom.iterable"]` (browser globals — `document`, `crypto`, `HTMLElement`, etc.)
- `emitDeclarationOnly: false`, `composite: false`, `declarationMap: false` (not supported by the Angular bundler)
- `rootDir: "./src"` (required when `composite` is unset)

`nx sync` was run once after creating `chat.service.ts` to register the new `frontend → libs/shared-types` project reference.

## Template fix

In Angular templates, `#textareaRef` resolves to the DOM element directly — not to `ElementRef`. The template uses `autoResize(textareaRef)` (no `.nativeElement`); inside the component, `this.textareaRef.nativeElement` is still correct because `@ViewChild('textareaRef')` returns `ElementRef<HTMLTextAreaElement>`.

## Static gates

- `npx nx lint frontend` → exit 0 (1 pre-existing `console.error` warning in `main.ts`, unrelated)
- `npx nx build frontend --configuration=development` → exit 0
- `npx nx build frontend --configuration=production` → exit 0 (initial bundle 274.48 kB, well under the 500 kB warning budget)
- `npx nx test frontend` → exit 0 (`app.spec.ts` rewritten to assert `<app-chat>` is rendered)

## Notes

- `apps/frontend/src/app/app.config.ts` not modified; `provideHttpClient()` was already registered.
- `apps/frontend/src/app/app.html` content is now exactly `<app-chat></app-chat>`.
- `environment.prod.ts` still holds the literal placeholder `YOUR_CLOUD_RUN_URL` — Plan 03 Task 2 (human setup) replaces it with the actual Cloud Run service URL.

## End-to-end smoke

Not run from this session (no `OPENROUTER_API_KEY` exported). The plan's manual smoke sequence (type "Hello, my name is Franek." → ask "What is my name?" → refresh → ask again) is documented in `.planning/phases/01-working-chat/01-02-PLAN.md` `<verification>`.
