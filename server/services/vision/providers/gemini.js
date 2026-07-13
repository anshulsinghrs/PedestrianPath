/**
 * Google Gemini vision provider. Raw HTTPS via `fetch` (no google SDK
 * dependency) to the generateContent endpoint with inline image data.
 */
'use strict';

const { VISION_PROMPT } = require('../prompt');
const { extractJson } = require('./util');

const NAME = process.env.GEMINI_VISION_MODEL || 'gemini-1.5-flash';

function isConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

async function analyze({ buffer, mimeType = 'image/jpeg', fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  if (!doFetch) throw new Error('fetch unavailable');
  if (!buffer) throw new Error('image buffer required');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: VISION_PROMPT },
            { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 700 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini vision responded ${res.status}`);
  const json = await res.json();
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '';
  return extractJson(text);
}

module.exports = { NAME, isConfigured, analyze };
