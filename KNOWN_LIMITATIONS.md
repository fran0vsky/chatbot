# Known Limitations

DinoAgents is early — here's what to expect.

---

## Voice features work best in Chrome

The talk-to-dino (voice assistant) and mic-in-the-composer (dictation) features rely on the browser's built-in speech API. Chrome has full support. **Firefox has no microphone access through this API**, so the voice controls are hidden there — everything else works normally.

## Free models may briefly pause or retry

DinoAgents uses a mix of free and paid AI models via OpenRouter. Under load, a free model can hit a rate limit (a 429 response). When that happens, the app automatically retries with a paid fallback model so you still get an answer — but you may notice a short pause or a slightly different response style. This is normal; you do not need to do anything.

## Image generation uses a paid model

There is no free image-generation model available through OpenRouter. When you chat with an image-gen dino (Vinci), each image costs a small amount. There is no free alternative at this time.

## Web search is temporarily unavailable

Dinos with web-search capability may currently show "Search unavailable" in some environments. When that happens they answer from their own knowledge instead. The limitation is tracked and will be resolved in a future deploy.

## Very large attachments or very long conversations may fail to send

The API accepts JSON payloads up to 10 MB. A very large image (above ~5 MB as a data URL) or an extremely long conversation history could hit this limit and fail to send. As a workaround, start a new chat or use a smaller image.

## Your data is tied to this browser and device

Chats, taught skills, and auto-extracted memories are linked to an anonymous ID stored in your browser's local storage. There is no account login yet, so **switching browsers, clearing site data, or using a different device starts fresh** — your previous conversations will not carry over.

---

## Operational Notes (for maintainers)

| User-facing limitation | Root cause |
|------------------------|-----------|
| Voice features Chrome-only | `SpeechRecognition` API absent in Firefox; `SpeechSynthesis` present but mic input missing |
| Free-model 429 → paid fallback pause | OpenRouter free models enforce per-minute rate limits; the backend retries once with `gpt-4o-mini` (paid) |
| No free image-gen model | No free image-generation model exists on OpenRouter at this time |
| Web search unavailable | `TAVILY_API_KEY` may not be set in the deployment environment; `web_search` tool returns a graceful degradation string |
| Large attachment / long history send failure | Express JSON body limit is 10 MB (`BODY_LIMIT` env, set in Phase 38); base64-encoded images above ~7 MB or histories with many image turns approach this limit |
| Data tied to browser/device | Anonymous `userId` generated on first visit and persisted in `localStorage` under the key `spino-user-id`; no cross-device sync or authentication in v1 |
| No automatic DB migration (historical) | Drizzle migrations now run automatically at boot (Phase 38-03); manual column adds are no longer required. If schema drift is suspected, check the boot logs for migration errors. |
