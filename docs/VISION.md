# AI Image Analysis (Vision-Language Models)

A modular vision service that analyses street-level report photos for
pedestrian-infrastructure conditions. Multiple model providers sit behind one
interface, so the provider can be switched with a single environment variable
without changing any business logic.

Lives in `server/services/vision/`.

## Providers

| Provider | Key required | Notes |
|----------|--------------|-------|
| `heuristic` | none (default) | Uses `sharp` image statistics. Produces a **real** lighting estimate from image brightness; scene detections are returned low-confidence with a note to configure a VLM. Always available, fully offline. |
| `anthropic` | `ANTHROPIC_API_KEY` + `@anthropic-ai/sdk` installed | Claude vision (default model `claude-opus-4-8`, override with `VISION_MODEL`). Uses the official SDK (lazy optional dependency). |
| `openai` | `OPENAI_API_KEY` | GPT-4o family via the Chat Completions API (`OPENAI_VISION_MODEL`, default `gpt-4o-mini`). |
| `gemini` | `GEMINI_API_KEY` | Gemini via `generateContent` (`GEMINI_VISION_MODEL`, default `gemini-1.5-flash`). |

Select with `VISION_PROVIDER=heuristic|anthropic|openai|gemini`. If the chosen
provider isn't actually usable (missing key/SDK), the service **falls back to
the heuristic provider** and marks the result with a `note` — image analysis
is best-effort enrichment and never fails a request.

## The provider abstraction

Every provider exports the same tiny interface:

```js
{ NAME, isConfigured(): boolean, analyze({ buffer, mimeType, fetchImpl }): Promise<raw> }
```

`services/vision/index.js` dispatches to the active provider, then
`schema.normalize()` coerces the provider's raw output into one canonical
shape. Because normalisation is centralised, the report pipeline, the REST API
and the client are all decoupled from the model vendor — swapping providers
changes one env var, nothing else.

## Prediction schema

```jsonc
{
  "provider": "anthropic",
  "model": "claude-opus-4-8",
  "detections": {
    "sidewalk":     { "present": true,  "confidence": 0.9 },
    "obstruction":  { "present": false, "confidence": 0.7 },
    "crossing":     { "present": false, "confidence": 0.8 },
    "pothole":      { "present": true,  "confidence": 0.85 },
    "encroachment": { "present": false, "confidence": 0.6 },
    "lighting":     { "level": "poor", "confidence": 0.8 }
  },
  "walkabilityEstimate": 42,
  "description": "Cracked footpath with a large pothole; no continuous sidewalk.",
  "suggestedSeverity": "major",
  "tags": ["pothole", "broken_surface"],
  "analyzedAt": "2026-07-13T…Z"
}
```

## API

### `POST /api/vision/analyze`
- multipart form field `image` (JPEG/PNG/WEBP/GIF), **or** JSON `{ "imageUrl": "…" }`
- optional `provider` to override `VISION_PROVIDER` per call
- → the prediction object above

### `GET /api/vision/status`
Active provider and which providers are configured:

```jsonc
{ "active": "heuristic",
  "providers": { "heuristic": {"configured": true,  "model": "heuristic-v1"},
                 "anthropic": {"configured": false, "model": "claude-opus-4-8"}, … },
  "detections": ["sidewalk","obstruction","crossing","pothole","lighting","encroachment"] }
```

## Persistence with reports

When a **hazard/infrastructure** report is submitted with a photo, the server
runs `analyzeImage()` best-effort and stores the prediction on the incident's
`aiAnalysis` field (`controllers/incidentController.js`). The client renders it
in the incident detail view. Analysis never blocks submission, and
**personal-safety reports never carry images or `aiAnalysis`** (enforced in the
`Incident` pre-save hook).

## Configuration

```bash
VISION_PROVIDER=heuristic         # heuristic | anthropic | openai | gemini
VISION_MODEL=claude-opus-4-8      # anthropic model override
ANTHROPIC_API_KEY=...             # for anthropic (also: npm i @anthropic-ai/sdk)
OPENAI_API_KEY=...                # for openai
GEMINI_API_KEY=...                # for gemini
```

## Tests

`server/test/vision.test.js` covers schema normalisation, the heuristic
provider (brightness → lighting), provider dispatch + fallback, status, and
JSON extraction — all offline. Run `npm test` in `server/`.
