'use strict';

/**
 * Extract a JSON object from a model's text response. Handles bare JSON,
 * ```json fenced blocks, and leading/trailing prose by locating the first
 * balanced `{ … }` span.
 */
function extractJson(text) {
  if (!text) throw new Error('empty model response');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

module.exports = { extractJson };
