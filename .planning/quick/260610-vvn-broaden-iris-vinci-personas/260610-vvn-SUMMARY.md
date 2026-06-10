---
quick_id: 260610-vvn
slug: broaden-iris-vinci-personas
status: complete
date: 2026-06-10
---

# Quick Task 260610-vvn: Broaden Iris & Vinci personas for group chat — Summary

## Problem

In group chat Iris and Vinci did nothing visible. The orchestrator describes
each dino by `persona` + `specialty`; both were framed as narrowly visual
("Image understanding, OCR" / "Image generation"), so the orchestrator never
picked them to contribute to text topics.

## What changed

**1. Iris → real general contributor**
([dinos.ts](../../../apps/backend/src/app/agents/dinos/dinos.ts))
Broadened `persona`, `blurb`, `specialty`, and `systemPrompt`: still the keen-eyed
image/OCR specialist, but now framed as a sharp, detail-oriented generalist who
answers any question well. Dropped the "I'm better with an image" hedge so on
text turns she just gives a useful answer. Iris is a vision-capable LLM, so it
answers text natively — no routing change needed.

**2. Vinci → opinionated reactor (not a broken answerer)**
Vinci is `imageGen: true` and routes to the dedicated image path, whose output
the group stream does not surface — so a Vinci "answer" in a group renders blank
and wastes a paid image call. (Its `systemPrompt` is also dead code on the image
path.) Instead of pretending it can answer text, broadened its `persona`/`blurb`/
`specialty` to "expressive, opinionated voice in group discussion" so the
orchestrator engages it as a reactor with personality.

**3. Engine guard — image dinos react, never answer in group**
([group-agents.service.ts](../../../apps/backend/src/app/agents/group-agents.service.ts))
New `isImageGenDino()` guard: any image-gen dino assigned `answer` in Round 1 or
Round 2 is converted to a reaction (`ARTIST_DEFAULT_REACTION` = 🎨, captioned
"appreciates the craft of that") targeting the user message (R1) or the
responded-to dino (R2). Guarantees the dino is visibly present, never a blank
bubble, and never burns a dropped image call. Added 🎨 to the shared reaction
vocabulary + `ARTIST_DEFAULT_REACTION` constant.

## Verification

- `nx test backend`: **all pass**; group-agents **15 passed** including a new
  test asserting an image-gen dino's `answer` is converted to a reaction and
  never calls `streamAgent`.
- `nx run @chatbot/ui:typecheck`: clean.

## Notes / trade-offs

- An `@Vinci draw X` mention in **group** mode now yields a 🎨 reaction rather
  than an image (group can't display images regardless). Single-dino chat with
  Vinci is unchanged — full image generation still works there.
- If surfacing generated images inside group chat is ever wanted, that's a
  larger change (new `GroupStreamEvent` image variant + frontend rendering).
