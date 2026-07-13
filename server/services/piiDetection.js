/**
 * PII detection for free-text fields submitted with incident reports.
 *
 * Scans for phone numbers, email addresses, and common name prefixes
 * across English, Hindi, and Marathi so that accidental personal
 * information is caught before storage.
 *
 * Returns { detected: bool, types: string[] }.
 */

// Matches Indian mobile numbers: 10 digits starting with 6-9,
// optionally prefixed with +91 or 0.
const PHONE_RE = /(?:\+91|0)?[6-9]\d{9}/g;

// RFC-5321-ish email pattern.
const EMAIL_RE = /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/gi;

// Name salutations in English, Hindi (Devanagari), and Marathi.
const NAME_SALUTATIONS = [
  // English
  /\b(mr|mrs|ms|miss|dr|prof)\b\.?\s+[A-Z][a-z]+/gi,
  // Hindi Devanagari — श्री, श्रीमती, डॉ
  /(?:श्री|श्रीमती|डॉ\.?)\s+\p{L}+/u,
  // Marathi — श्री, श्रीमती common to both; also आई, दादा used as references
];

// Aadhaar-style 12-digit number (4-4-4 groups or plain).
const AADHAAR_RE = /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g;

function detectPii(text) {
  if (!text || typeof text !== 'string') return { detected: false, types: [] };

  const types = new Set();

  if (PHONE_RE.test(text)) types.add('phone');
  PHONE_RE.lastIndex = 0;

  if (EMAIL_RE.test(text)) types.add('email');
  EMAIL_RE.lastIndex = 0;

  if (AADHAAR_RE.test(text)) types.add('aadhaar');
  AADHAAR_RE.lastIndex = 0;

  for (const re of NAME_SALUTATIONS) {
    if (re.test(text)) {
      types.add('name');
      break;
    }
  }

  return { detected: types.size > 0, types: [...types] };
}

module.exports = { detectPii };
