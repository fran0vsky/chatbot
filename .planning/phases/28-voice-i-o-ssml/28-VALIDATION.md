---
phase: 28
slug: voice-i-o-ssml
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | per-lib vitest config (libs/ui) |
| **Quick run command** | `npm exec nx test ui` |
| **Full suite command** | `npm exec nx run-many -t test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm exec nx test ui`
- **After every plan wave:** Run `npm exec nx run-many -t test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-xx | 01 | 0 | VOX-01/03 | — | Web Speech API mocked; feature-detection returns false safely when API absent | unit | `npm exec nx test ui` | ❌ W0 | ⬜ pending |
| 28-01-xx | 01 | 1 | VOX-01 | — | TTS speaks last assistant message via SpeechSynthesis; stop cancels utterance | unit | `npm exec nx test ui` | ❌ W0 | ⬜ pending |
| 28-01-xx | 01 | 1 | VOX-02 | — | SsmlHint maps rate/pitch/volume onto SpeechSynthesisUtterance; SSML markup never spoken literally | unit | `npm exec nx test ui` | ❌ W0 | ⬜ pending |
| 28-01-xx | 01 | 1 | VOX-03 | — | STT result injected into InputComposer.draft inside NgZone.run | unit | `npm exec nx test ui` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · Final task IDs assigned by planner.*

---

## Wave 0 Requirements

- [ ] Mock harness for `window.speechSynthesis` (`vi.fn()` + `Object.defineProperty`) — jsdom has no Web Speech API
- [ ] Mock harness for `window.SpeechRecognition` / `webkitSpeechRecognition`
- [ ] `@types/dom-speech-recognition` devDependency installed (npm, `--legacy-peer-deps`)
- [ ] Spec stubs for the TTS service, STT service, and the SSML→utterance mapper

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audible speech actually plays | VOX-01 | Real audio output cannot be asserted in jsdom/CI | In Chrome over HTTPS/localhost, click "read aloud" on an assistant message → hear speech; click stop → speech halts |
| Live dictation transcribes | VOX-03 | Requires real mic + browser SpeechRecognition permission | In Chrome, click mic, grant permission, speak → words appear in composer draft |
| Prosody sounds natural | VOX-02 | Subjective audio quality; SpeechSynthesis prosody is perceptual | Read aloud a message with SsmlHint rate/pitch applied → confirm no literal angle-brackets spoken, pacing differs from default |
| Mic button hidden when unsupported | VOX-03 | Cross-browser (Firefox STT disabled) | Open in Firefox → mic button absent, TTS still available |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
