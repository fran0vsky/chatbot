---
phase: 26-image-generation
plan: 26-01
status: CODE-COMPLETE (human UAT pending)
completed: 2026-06-04
requirements: [IMG-01, IMG-02]
depends_on:
  - phase: 25-multimodal-input
    provides: ChatMessage.imageDataUrl + inline image rendering in bubbles
---

**A new artist dino, Vinci (Parasaurolophus), turns a text prompt into an original image rendered inline with a download link, via a dedicated image-generation path.**

## Spike — image-model availability & cost (decision input)

Queried `GET /api/v1/models` for `output_modalities` containing `image`. **No free image model exists on OpenRouter** — all are paid. Tested the cheapest, `google/gemini-2.5-flash-image`:
- Returns the image at `choices[0].message.images[0].image_url.url` as a base64 PNG data URL (~880 KB), plus a short text caption in `content`.
- **Cost: $0.0387 per image** (confirmed via `usage.cost`; 1290 image tokens).

User approved the cheapest paid model. This is the only dino that costs real money per turn.

## Architecture decision

Image generation does **not** fit the LangChain text agent loop: the response is single-shot (no token stream, no tools), and `ChatOpenAI` does not surface the `images` field. So artist dinos take a **dedicated path**: `streamAgent` branches on `dino.imageGen` to `streamImageGeneration`, which calls OpenRouter directly (`fetch`, `modalities: ['image','text']`), then emits the caption token, a new `StreamImageEvent`, and `done`.

## Accomplishments
- **Shared types:** `StreamImageEvent { type:'image'; imageDataUrl }` added to the `StreamEvent` union; `Dino.imageGen?: boolean` (also surfaced on `DinoSummary` via `toDinoSummary`).
- **Registry:** added **Vinci** (Parasaurolophus, accent `#c2410c`, `imageGen: true`) on `google/gemini-2.5-flash-image`, no tools.
- **Backend:** `streamImageGeneration` — direct OpenRouter call with a 45 s timeout (`AbortSignal.any([clientSignal, timeout])`), capability-error handling reusing `isCapabilityError`, forwards an attached input image (enables image editing). Branch added early in `streamAgent`.
- **Frontend:** `streamingImage` signal; `handleStreamEvent` `image` case sets it live; `commitTurn` persists it onto the assistant `ChatMessage.imageDataUrl`; `clearStreaming` resets it; live streaming bubble + guards updated to show an image even with no caption.
- **Rendering:** assistant bubble renders the generated image with a Download link (`<a download>` on the data URL). Reuses the `ChatMessage.imageDataUrl` field from Phase 25.

## Verification
- `nx run-many -t build -p @org/backend frontend` ✓ (only pre-existing prismjs CommonJS warnings)
- Image output shape + cost confirmed live against `google/gemini-2.5-flash-image` during the spike.

## Known MVP limitations
- Each generation is independent (no multi-turn image-conversation history).
- One image per turn; ~$0.04 per generation (paid).

## Follow-up (human)
See `26-HUMAN-UAT.md` — generate an image with Vinci in the browser, confirm inline render + download, and confirm graceful error handling.
