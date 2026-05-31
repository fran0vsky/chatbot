# Phase 28: Voice I/O + SSML - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 28-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 28-voice-i-o-ssml
**Areas discussed:** Per-dino voice personality, Auto-read vs manual, SSML provider strategy, Voice picker UX

---

## Per-dino voice personality

| Option | Description | Selected |
|--------|-------------|----------|
| Per-dino profile (rate+pitch, optional voice) | voiceProfile per dino read by the SsmlHint converter; degrades to default | ✓ |
| Rate/pitch only per dino | vary just rate & pitch, no OS voice matching | |
| Single default voice | all dinos share one system voice | |

**User's choice:** Per-dino profile (rate + pitch + optional preferred voice).
**Notes:** Profile home (backend registry vs frontend map) was not answered — defaulted to **backend dino registry** (single source of truth) for capture; user can override.

---

## Auto-read vs manual

| Option | Description | Selected |
|--------|-------------|----------|
| Manual only (click speaker) | user clicks read-aloud per message; matches UI-SPEC | ✓ |
| Auto-read, toggle OFF by default | toggle; ON auto-speaks new replies | |
| Auto-read ON by default | replies speak automatically | |

**User's choice:** Manual only (click speaker).
**Notes:** Auto-read deferred. The follow-up about a toggle's home/persistence became moot and was not pursued.

---

## SSML provider strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Browser-only MVP + clean seam | free Web Speech path; SSML via rate/pitch hints; TtsProvider seam for later | ✓ |
| Browser default + wire a paid adapter now | also implement Azure/ElevenLabs behind the seam | |

**User's choice:** Browser-only MVP + clean seam.
**Notes:** Free/browser fallback is a hard constraint regardless.

---

## Voice picker UX

| Option | Description | Selected |
|--------|-------------|----------|
| Surface a voice picker this phase | user chooses among OS voices | |
| System default + defer picker | research recommendation | (default) |

**User's choice:** Selected as an area but the specific follow-up was not asked before the session was interrupted. Captured with the research-recommended default (defer picker; per-dino `preferredVoice` covers character). Flagged in CONTEXT.md for the user to override.

---

## Claude's Discretion

- Hand-rolled voice services (vs `@ng-web-apis/speech`).
- `NgZone.run()` wrapping of recognition callbacks (zone-based change detection).

## Deferred Ideas

- Auto-read / hands-free playback; paid real-SSML provider behind the seam; user-facing voice picker; LLM-generated prosody hints; multi-voice in groupchat/arena.
