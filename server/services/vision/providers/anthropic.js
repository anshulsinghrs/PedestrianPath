/**
 * Anthropic (Claude) vision provider.
 *
 * Uses the official `@anthropic-ai/sdk` when it is installed and
 * `ANTHROPIC_API_KEY` is set — a lazy, optional dependency so the base
 * server install stays lean and this provider simply reports "unconfigured"
 * when the SDK/key are absent. Sends the image as a base64 block before the
 * instruction text, per the Messages API vision format.
 */
'use strict';

const { VISION_PROMPT } = require('../prompt');
const { extractJson } = require('./util');

const NAME = process.env.VISION_MODEL || 'claude-opus-4-8';

let sdk;
function loadSdk() {
  if (sdk !== undefined) return sdk;
  try {
    sdk = require('@anthropic-ai/sdk');
  } catch {
    sdk = null;
  }
  return sdk;
}

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY && !!loadSdk();
}

async function analyze({ buffer, mimeType = 'image/jpeg' } = {}) {
  const Anthropic = loadSdk();
  if (!Anthropic) throw new Error('@anthropic-ai/sdk is not installed');
  if (!buffer) throw new Error('image buffer required');

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const message = await client.messages.create({
    model: NAME,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: buffer.toString('base64'),
            },
          },
          { type: 'text', text: VISION_PROMPT },
        ],
      },
    ],
  });

  const text = (message.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return extractJson(text);
}

module.exports = { NAME, isConfigured, analyze };
