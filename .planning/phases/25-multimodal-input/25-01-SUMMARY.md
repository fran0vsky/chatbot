---
phase: 25-multimodal-input
plan: 25-01
status: CODE-COMPLETE (human vision UAT pending)
completed: 2026-06-04
requirements: [VIS-01, VIS-02, VIS-03, VIS-04]
depends_on:
  - phase: 18-dino-abstraction
    provides: dino registry (server-side model + system prompt + toolNames); manual agent loop
---

**Users can paste or attach an image into the composer; a new vision dino, Iris (Troodon), reasons about it and transcribes text (OCR) on a free OpenRouter vision model, with a vision-capable paid fallback when the free model is rate-limited.**

## Spike (VIS-04) — free vision model viability

Queried `GET /api/v1/models` for `:free` models with `image` input modality, then tested each with a real text image ("DINO 42") for vision + OCR:

| Model | Result |
|-------|--------|
| `nvidia/nemotron-nano-12b-v2-vl:free` | ✅ correct OCR, 2.1s — **chosen as Iris's model** |
| `moonshotai/kimi-k2.6:free` | ✅ correct OCR, 2.9s — viable backup |
| `google/gemma-4-31b-it:free` / `gemma-4-26b-a4b-it:free` | ❌ provider error / 429 (transient) |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | ⚠️ slow reasoning model, skipped |

The hybrid failover already in `agents.service.ts` (`FALLBACK_MODEL = openai/gpt-4o-mini`) is itself vision-capable, so a 429 or timeout on the free vision model still completes the turn — satisfying the VIS-04 graceful-degradation clause.

## Accomplishments
- **Shared types:** `ChatRequest.imageDataUrl?` and `ChatMessage.imageDataUrl?` (base64 data URL; one image per turn).
- **Backend:** `streamAgent` builds a multimodal `HumanMessage` (`[{type:text},{type:image_url}]`) when an image is present; controller threads `body.imageDataUrl`. Non-vision dinos that receive an image error → existing failover to the vision-capable fallback model.
- **Dino registry:** added **Iris** (Troodon, accent `#2f8f8f`) on `nvidia/nemotron-nano-12b-v2-vl:free`, no tools, system prompt tuned for accurate description + verbatim OCR.
- **Composer (`InputComposer`):** `allowImage` input gates an attach button + hidden file input + textarea paste handler; client-side downscale to 1024px longest edge (JPEG q0.85), 5 MB cap, image-only sends allowed; thumbnail preview with remove; `send` now emits `ComposerSubmit { text, imageDataUrl? }`.
- **Rendering:** user message bubbles render `imageDataUrl` inline; image rides on the `ChatMessage` into the NgRx store and persists in session history. Regenerate preserves the image; groupchat stays text-only.

## Verification
- `nx run-many -t build -p @org/backend frontend` ✓ (only pre-existing prismjs CommonJS warnings)
- Vision + OCR confirmed live against `nvidia/nemotron-nano-12b-v2-vl:free` during the spike.

## Known MVP limitations
- One image per turn; history replay is text-only (a follow-up about a prior image does not resend the image).
- OCR is prompt-based (no dedicated button), per the chosen approach.

## Follow-up (human)
See `25-HUMAN-UAT.md` — paste/attach an image to Iris in the browser, confirm description + OCR, and confirm graceful behavior when the free model is rate-limited.
