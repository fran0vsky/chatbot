---
phase: 29-voice-dino-assistant
plan: 29-01
status: CODE-COMPLETE (human UAT pending)
completed: 2026-06-04
requirements: [AST-01, AST-02, AST-03, AST-04]
depends_on:
  - phase: 27-ngrx-state-refactor
    provides: ACTION_CATALOGUE + dispatchCatalogued safety gate
  - phase: 28-voice-i-o-ssml
    provides: VoiceRecognitionService (STT) + VoiceSynthesisService (TTS)
---

**A floating voice assistant turns spoken commands into whitelisted app actions: it listens (STT), sends the transcript to a backend intent parser, then either dispatches an action through the Phase 27 catalogue, asks a clarifying question, or refuses — speaking the result aloud (TTS).**

## Architecture

`mic (STT) → POST /api/assistant/interpret → AssistantDecision → dispatchCatalogued | speak`

- **Backend `AssistantService.interpret`** (gpt-4o-mini, temperature 0, `response_format: json_object`): builds a system prompt listing the whitelist + the live SESSIONS/DINOS/CURRENT_VIEW context, returns one of `{kind:'action',name,params,say}` / `{kind:'clarify',say}` / `{kind:'refuse',say}`. Defensive parse + whitelist re-check; never throws (falls back to clarify). Uses a cheap paid model directly because the assistant brain is latency-sensitive and must be reliable (~$0.0001/command).
- **Frontend `AssistantService`** (providedIn root): state machine `idle→listening→thinking→idle`; an effect captures the final STT transcript, POSTs interpret, then `executeDecision` dispatches via `dispatchCatalogued` (the safety gate) or speaks clarify/refuse. read_last_message and send_message are dispatched as marker actions handled by ChatComponent.
- **Safety (AST-03):** unsupported/destructive capabilities are structurally absent from the catalogue, and `dispatchCatalogued` re-validates name+params, so a hallucinated action can't fire.

## Accomplishments
- Shared types `assistant.types.ts` (interpret request + `AssistantDecision`).
- Backend `AssistantModule` (controller + service) wired into `AppModule`.
- Frontend `AssistantService`; `VoiceRecognitionService.reset()` so consumed commands never leak into the composer.
- ChatComponent: injects the assistant, gates the dictation-mirror effect on `assistant.active()`, adds the `send_message` marker listener (read_last_message already existed), and `onAssistantToggle()` supplies live context (sessions, dinos, current view) for AST-04.
- Floating assistant button in `chat.html` with listening (pulse) / thinking (spinner) states + a live caption showing the heard command and spoken reply. Hidden when STT is unsupported (Firefox).

## Verification
- `nx run-many -t build -p @org/backend frontend` ✓ (only pre-existing prismjs warnings)
- Intent parser tested live against gpt-4o-mini with 8 representative commands → **8/8 correct** schema + intent: theme switch, read-last, select dino ("talk to Iris"), switch chat by topic (AST-04), refuse ("delete my account"), send message, navigate, and an ambiguous command.

## Known MVP limitations
- One command per button press (no continuous conversation).
- "say" wording comes from the model; not all edge phrasings are perfectly clarify-vs-refuse classified.

## Follow-up (human)
See `29-HUMAN-UAT.md` — in Chrome, click the assistant button and speak commands covering the four AST requirements.
