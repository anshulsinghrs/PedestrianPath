/**
 * Crisis keyword detection for Module 3 (Personal Safety) free-text descriptions.
 *
 * Covers English, Hindi (Devanagari), and Marathi trigger phrases that
 * indicate the reporter may be in immediate danger or severe distress.
 *
 * Returns { crisis: bool, matchedKeywords: string[] }.
 *
 * When a crisis is flagged the API response includes a `crisisAlert` field
 * pointing reporters to emergency resources — no raw keywords are echoed.
 */

const CRISIS_KEYWORDS = [
  // English
  'help me',
  'being followed',
  'following me',
  'stalking me',
  'i am unsafe',
  "i'm unsafe",
  'call police',
  'emergency',
  'danger',
  'assault',
  'attacked',
  'being attacked',
  'rape',
  'sexual assault',
  'kidnap',
  'abduct',

  // Hindi (Devanagari)
  'बचाओ',        // bachao — save me / help
  'मदद करो',     // madad karo — help me
  'पुलिस बुलाओ', // pulis bulao — call police
  'खतरा',        // khatara — danger
  'पीछा कर',     // peecha kar — following / stalking
  'हमला',        // hamla — attack
  'बलात्कार',    // balaatkaar — rape
  'अपहरण',       // apaharan — kidnapping

  // Marathi (Devanagari — overlaps with Hindi for several terms)
  'वाचवा',       // vaachva — save me
  'मदत करा',     // madat kara — help me
  'पोलीस बोलवा', // polees bolwa — call police
  'धोका',        // dhoka — danger/threat
  'पाठलाग',      // paathlaag — being followed / stalking
  'हल्ला',       // halla — attack
  'बलात्कार',    // same as Hindi
];

function detectCrisis(text) {
  if (!text || typeof text !== 'string') return { crisis: false, matchedKeywords: [] };

  const lower = text.toLowerCase();
  const matched = CRISIS_KEYWORDS.filter((kw) =>
    lower.includes(kw.toLowerCase())
  );

  return { crisis: matched.length > 0, matchedKeywords: matched };
}

module.exports = { detectCrisis };
