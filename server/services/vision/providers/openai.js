/**
 * OpenAI (GPT-4o family) vision provider. Raw HTTPS via `fetch` so no
 * OpenAI SDK dependency is added — the adapter is a thin, key-gated call to
 * the Chat Completions API with an image data-URI.
 */
'use strict';

const { VISION_PROMPT } = require('../prompt');
const { extractJson } = require('./util');

const NAME = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

async function analyze({ buffer, mimeType = 'image/jpeg', fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;
  if (!doFetch) throw new Error('fetch unavailable');
  if (!buffer) throw new Error('image buffer required');

  const res = await doFetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: NAME,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${buffer.toString('base64')}`,
              },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI vision responded ${res.status}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  return extractJson(text);
}

module.exports = { NAME, isConfigured, analyze };
