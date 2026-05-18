<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Chatbot**

A general-purpose text chatbot built as an Nx monorepo with an Angular frontend and NestJS backend. Users can ask the model anything and continue the conversation across multiple turns in the same session. The backend uses LangGraph to orchestrate LLM calls via OpenRouter.

**Core Value:** A user can open the app, type a message, get a real answer, and keep the conversation going — everything else is secondary.

### Constraints

- **Tech stack:** Angular + NestJS + LangGraph — locked, no framework changes
- **LLM provider:** OpenRouter (replaces Gemini) — user specified
- **Conversation scope:** Per-session only — MemorySaver stays, no database needed for Task 1
- **Styling:** Tailwind CSS only — no inline styles, per project conventions
- **Components:** Angular standalone components with OnPush change detection — per project conventions
<!-- GSD:project-end -->

**For detailed tech stack, conventions, architecture, and project skills—see [`.planning/GSD-CONTEXT.md`](.planning/GSD-CONTEXT.md) (loaded during `/gsd-*` workflows).**

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
