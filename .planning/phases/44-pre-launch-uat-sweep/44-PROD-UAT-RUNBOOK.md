# DinoAgents — Production UAT Runbook

**Target:** https://dinoagents.duckdns.org  
**Date:** _______________  
**Tester:** _______________  
**Goal:** Execute every pending HUMAN-UAT item against the live site, triage results, and clear the path for first real users.

---

## Triage Rule

| Severity | Definition | Action |
|----------|-----------|--------|
| **blocker** | Breaks a first-touch feature or loses user data | Fix in-phase (Plan 04) before showing to real users |
| **minor** | Cosmetic, edge-case, or non-blocking rough edge | File to backlog; does not delay launch |

State it once, apply everywhere: if in doubt, ask "would a first user give up because of this?" — yes → blocker; no → minor.

---

## Known Prod Issues — Do NOT Re-File as New Blockers

These were documented production gaps (pre-Phase 38, 2026-06-12 investigation). Phase 38 addressed all three; if you encounter them during this sweep it indicates an **incomplete Phase 38 deploy** — escalate as a deployment regression, not a new feature bug.

- **Web search unavailable** — `web_search` returned "Search unavailable" because `TAVILY_API_KEY` was not in Secret Manager. Phase 38 (38-02) wired the `tavily-api-key` secret into `vm-deploy.sh`. If you still see "Search unavailable", escalate as a deploy regression.
- **Large image / long history may 413** — Express default 100 kb JSON body limit caused 413 errors for attached images or long histories. Phase 38 (38-01) raised the limit to 10 MB (`BODY_LIMIT` env). If you get 413 on a normal-sized image, escalate.
- **No auto DB migration (schema drift)** — Cloud SQL could drift behind `schema.ts` requiring manual column adds. Phase 38 (38-03) added automated migrations at boot. Schema drift should no longer silently break features.

---

## Tier-0: First-Touch Happy Paths (Run First)

These five checks must pass before anything else. They represent what a brand-new user will do first.

### T0-1. Single Chat

- [ ] Open https://dinoagents.duckdns.org in a fresh browser session
- [ ] Select any dino from the picker (e.g. Rexford)
- [ ] Type "Hello, who are you?" and press Send
- [ ] Confirm the response streams in token-by-token (SSE works)
- [ ] Confirm a coherent, on-persona answer arrives

  Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

### T0-2. Group Chat

- [ ] Open Group Chat mode (select 3–4 dinos)
- [ ] Type a question (e.g. "What's your favourite food?") and send
- [ ] Confirm all selected dinos reply with distinct answers
- [ ] Confirm dino names are labelled on each response (not "A" / "B")
- [ ] Confirm emoji reaction chips appear on messages

  Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

### T0-3. Image Attach

- [ ] Start a chat with Iris (Troodon, the vision dino)
- [ ] Attach a screenshot or photo via the attach button (or paste)
- [ ] Confirm a thumbnail preview appears with a remove (×) button
- [ ] Ask "What's in this image?" and send
- [ ] Confirm the image shows inline in the user bubble
- [ ] Confirm Iris describes the image content accurately

  Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

### T0-4. Image Generation

- [ ] Start a chat with Vinci (Parasaurolophus, the image-gen dino)
- [ ] Type "draw a pixel-art volcano at sunset" and send
- [ ] Wait up to 45 seconds
- [ ] Confirm an image renders inline in Vinci's reply with a caption
- [ ] Confirm a "Download" link is present below the image

  Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

### T0-5. Voice Assistant (Chrome only)

- [ ] Open the app in **Chrome**
- [ ] Click the floating assistant button (bottom-right)
- [ ] Allow microphone access when prompted
- [ ] Say "switch to night mode"
- [ ] Confirm the theme flips and the assistant speaks a confirmation

  Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

## Tier-1: Full Pending Backlog

Run these after Tier-0 passes. All steps are on https://dinoagents.duckdns.org — no local server setup required.

---

### Phase 21: Cross-Thread Memory

Source: [21-01-SUMMARY.md](../21-cross-thread-memory/21-01-SUMMARY.md) — manual cross-thread smoke test (Task 5).

1. [ ] Start a chat with rexford. Tell it a specific fact: "My name is Alex and I love trains."
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] Open a **new chat** (same browser session, same dino rexford). Ask "Do you remember anything about me?"
   — Expected: rexford recalls the fact from the previous thread without being re-told.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] Switch to a different dino (e.g. veloce). Ask "Do you remember anything about me?"
   — Expected: veloce does NOT know the fact (cross-dino isolation).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

> **Note:** The null-DB degradation path (unset `DATABASE_URL`) is a localhost-only check — skip on prod.

---

### Phase 22: Teach-a-Skill

Source: [22-01-SUMMARY.md](../22-teach-a-skill/22-01-SUMMARY.md) — teach-once smoke test (Task 5).

1. [ ] Open a chat with rexford. Click the "Teach" button and teach the skill: title "British English", instruction "Always reply in formal British English."
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] Start a **new chat** with rexford (don't re-teach). Send a message.
   — Expected: rexford automatically replies in formal British English without being prompted.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] Open the skills manager. Delete the "British English" skill. Start another new chat with rexford and send a message.
   — Expected: rexford no longer uses British English (skill is gone).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

4. [ ] Check veloce in a separate chat — it should be unaware of any rexford skill (per-dino isolation).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

> **Note:** The null-DB degradation path (unset `DATABASE_URL`) is a localhost-only check — skip on prod.

---

### Phase 24: Arena + Leaderboard

Source: [24-HUMAN-UAT.md](../24-arena-leaderboard/24-HUMAN-UAT.md).

1. [ ] Navigate to the Arena tab. Enter a prompt (e.g. "Explain quantum entanglement simply."). Two anonymous panels (A / B) stream in parallel with identities hidden.
   — Expected: both panels stream concurrently; identities stay hidden until voting.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] Once both finish streaming, cast a vote for the better response.
   — Expected: both dino identities reveal (name + persona); updated ratings appear.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] Open the Leaderboard tab.
   — Expected: the winner's rating went up and the loser's went down; running 2–3 battles accumulates cumulatively.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

> **Note:** The null-DB degradation path (Leaderboard shows all dinos at rating 1000 / 0 games) is a localhost-only check — skip on prod.

---

### Phase 25: Multimodal Input (Image Attach + Vision)

Source: [25-HUMAN-UAT.md](../25-multimodal-input/25-HUMAN-UAT.md).

1. [ ] **Attach + vision reasoning (VIS-01, VIS-02):** Start a chat with Iris. Click the attach button OR paste a screenshot into the composer → thumbnail preview appears with a remove (×) button. Send with "what's in this image?" → the user bubble shows the image inline and Iris describes it accurately.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **OCR (VIS-03):** Attach a screenshot containing visible text and ask "extract the text." Iris reproduces the text accurately (preserving order/line breaks), not a paraphrase.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **Image-only send + paste:** Paste an image with no typed text — send button is enabled and a response is produced. Pasting plain text into the composer still types normally (no interference).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

4. [ ] **Oversized file rejection:** Try attaching a non-image file or a file > 5 MB → a friendly error message appears; the file is not sent.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

> **Note:** The 429 paid-fallback degradation path (VIS-04) is not reliably provokable on prod — skip unless naturally encountered.

---

### Phase 26: Image Generation

Source: [26-HUMAN-UAT.md](../26-image-generation/26-HUMAN-UAT.md).

1. [ ] **Generate an image (IMG-01):** Chat with Vinci (Parasaurolophus). Type "a pixel-art volcano at sunset" → after a few seconds an image appears inline in Vinci's reply with a short caption.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **Inline render + download (IMG-02):** The generated image renders at a reasonable size inside the assistant bubble. A "Download" link saves the PNG to disk.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **Persists in history:** Switch to another chat and return (or reload). The generated image still shows in the conversation history — it is not transient.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

4. [ ] **Graceful error:** Chat with a normal text dino and send any message — confirm it is unaffected by image generation (no cross-contamination).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

### Phase 27: NgRx State Refactor — Full Regression Sweep

Source: [27-HUMAN-UAT.md](../27-ngrx-state-refactor/27-HUMAN-UAT.md).

1. [ ] **Core chat flows:** Send a message → stream arrives → stop mid-stream → regenerate → edit and re-send. All behave correctly.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **Theme toggle:** Toggle dark/light mode → confirm it persists on reload.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **History panel:** Switch between chats, rename a chat, pin a chat, delete a chat — all work.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

4. [ ] **Group chat dino names:** In group chat, confirm dino names (not "A"/"B") appear on each response (tests the CR-01 fix).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

5. [ ] **Arena + Leaderboard + Explore:** Each tab opens without error.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

> **Note (Redux DevTools check — optional):** If DevTools are installed, confirm each interaction dispatches expected catalogued/feature actions and the store updates correctly.

---

### Phase 28: Voice I/O + SSML

Source: [28-HUMAN-UAT.md](../28-voice-i-o-ssml/28-HUMAN-UAT.md) — **Status: PASSED** (verified 2026-06-11).

These checks already passed human UAT. Re-run as a quick regression pass on prod:

1. [ ] **TTS smoke test:** Hover an assistant message → click the speaker button → audible speech plays in the dino's voice character. "Dino is speaking…" header appears. Stop button halts speech immediately.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **Chrome dictation (VOX-03):** In Chrome, tap the mic button → allow permission → interim transcription appears live in the composer draft → on final result mic returns to idle. Nothing auto-submits.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **Firefox mic absence:** In Firefox, confirm the mic button is not rendered; composer works normally.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

### Phase 29: Voice Dino Assistant

Source: [29-HUMAN-UAT.md](../29-voice-dino-assistant/29-HUMAN-UAT.md).

All checks require **Chrome** with microphone access. The floating assistant button (bottom-right) must be visible.

1. [ ] **Voice command fires an action (AST-01):** Say "switch to night mode" → theme flips and the assistant speaks a confirmation. Try "go to the leaderboard" and "start a new chat" — each navigates/acts correctly.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **Read aloud (AST-01 variant):** Say "read that again" (after receiving an assistant message) → the last assistant message is spoken aloud.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **Ambiguous → clarify (AST-02):** Say something vague like "do the thing" → the assistant asks a clarifying question by voice instead of guessing or acting.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

4. [ ] **Out-of-scope → refuse (AST-03):** Say "delete my account" → the assistant says it can't do that; nothing in the app changes.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

5. [ ] **Find & switch a past chat (AST-04):** With at least one past chat about a recognizable topic, say "open my chat about [topic]" → the app switches to that conversation.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

6. [ ] **No composer leak:** After using voice commands, the message composer is empty (command speech does not appear there — that's the mic/dictation button, which is separate).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

7. [ ] **Firefox absence:** In Firefox, confirm the floating assistant button is not shown.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

### Phase 32: Working Memory — Context Replay

Source: [32-01-SUMMARY.md](../32-working-memory-context-ring/32-01-SUMMARY.md) — live UAT (Task 5, CTX-01 + CTX-02 + no-regression).

1. [ ] **Image reuse (CTX-01):** Attach an image in a chat with Iris and ask "what's in this image?" → Iris describes it. Then, in the same thread, ask a follow-up question about the image WITHOUT re-attaching it (e.g. "What colour is the main object?") → Iris answers using the context from the previous turn's image.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **Tool-result reuse (CTX-02):** Chat with a dino that has web search. Ask a question that triggers a `web_search` tool call. Then ask a follow-up that references the fetched result (e.g. "Summarise what you just found") → the dino uses the prior tool result without re-fetching.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **Single-turn no-regression:** Send a single text message (no image, no tools) → confirm normal response arrives without errors or extra latency.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

### Phase 34: AI Memory Creator

Source: [34-02-SUMMARY.md](../34-ai-memory-creator/34-02-SUMMARY.md) — HUMAN-UAT Task 4 (SC#1–SC#4).

1. [ ] **Conversation-derived suggestions (SC#1):** Have a short conversation with a dino (a few back-and-forth turns). Click the brain button → the dino "thinking" state shows (animated), then ≥3 conversation-derived skill suggestions appear.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **Pick-a-suggestion flow (SC#2a):** Pick one of the suggestions → the editable name / when-to-activate / instruction form pre-fills with synthesized content.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **Free-text flow (SC#2b):** Type a free-text description in the input instead of picking a suggestion → the same 3-field form pre-fills from that text.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

4. [ ] **Save + auto-apply (SC#3):** Save the skill → it appears in the skill manager. Start a new chat with the same dino → the skill auto-applies without re-teaching. Save a clearly overlapping item → it UPDATES the existing skill (no duplicate).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

5. [ ] **Manual teach still works (SC#4):** The "teach a skill manually" disclosure is present; the manual title + instruction teach form still functions; existing skills and memories still appear in the manager.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

### Phase 35: Conversational Group Chat + Persistence

Source: [35-HUMAN-UAT.md](../35-conversational-group-chat/35-HUMAN-UAT.md) — **Status: PASSED** (verified 2026-06-11).

These checks already passed human UAT. Re-run as a quick regression pass on prod:

1. [ ] **Turn-based group conversation:** Select 3–4 dinos in group chat. Send a message → Round-1 answerers stream concurrently top-to-bottom; @mention a specific dino by name → that dino always replies; at least sometimes a non-addressed dino volunteers in Round 2 naming who it responds to.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

2. [ ] **Emoji reactions:** Reaction chips appear and are pinned to their target message.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

3. [ ] **Persist + reopen:** End the group thread and open another chat. Navigate back to the group thread via the history panel → the full interleaved transcript is restored top-to-bottom AND the exact participant dino selection is restored, with the view in groupchat mode.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

4. [ ] **History panel indicator:** The completed group thread appears in the history panel with a group indicator (participant-mascot cluster or similar).
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

### Phase 37: Intent-Driven Group Engine

Source: No standalone Phase 37 UAT script exists. Phase 37 extended the group-chat engine introduced in Phase 35; its behaviour is covered by the Phase 35 checks above.

> **Note:** Phase 37 was verified as working on the live site during the 2026-06-12 prod probe ("group chat (Phase 37 engine) WORKS in production"). The Phase 35 group-chat regression checks above also exercise the Phase 37 engine. No separate Phase 37 script exists — record this consolidated check:

1. [ ] **Phase 37 group engine (consolidated):** The group-chat conversation above (Phase 35 check 1) exercised the intent-driven engine — dinos volunteer responses autonomously, name who they are responding to, and handle @mentions. This single check records Phase 37 coverage.
   — Covered by Phase 35 T1 check 1. Record the same result here for traceability.
   Result: [ PASS / FAIL ]  Severity: [ blocker / minor ]  Defect: ____

---

## Sweep Complete — Triage Summary

Fill in after all checks are done.

| Item | Phase | Result | Severity |
|------|-------|--------|----------|
|      |       |        |          |

**Blockers (fix in-phase — Plan 04):**
- 

**Minor issues (file to backlog):**
- 

**Outcome:** [ All clear — ready for first users ] / [ Blockers found — Plan 04 required ]
