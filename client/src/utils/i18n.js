// Minimal i18n scaffold — no runtime dependencies.
//
// Locales are plain JSON-style objects keyed by message id. The active
// locale is picked from (in order): localStorage("alertcycle-locale"),
// the user's saved profile locale, navigator.language, and finally "en".
//
// To add a language, drop a new entry in MESSAGES and the strings
// automatically become available to t().

const MESSAGES = {
  en: {
    'brand.tagline': 'Urban Mobility Safety Platform',
    'nav.report': '+ Report incident',
    'nav.signin': 'Sign in',
    'nav.map': 'Map',
    'nav.analytics': 'Analytics',
    'report.title': 'Report a road safety incident',
    'report.mode': 'You are reporting as',
    'report.type': 'Incident type',
    'report.severity': 'Severity',
    'report.consent': 'Allow this anonymized report to be used for safety research',
    'analytics.title': 'Urban mobility safety analytics',
    'common.loading': 'Loading…',
  },
  hi: {
    'brand.tagline': 'शहरी गतिशीलता सुरक्षा मंच',
    'nav.report': '+ घटना रिपोर्ट करें',
    'nav.signin': 'साइन इन करें',
    'nav.map': 'मानचित्र',
    'nav.analytics': 'विश्लेषण',
    'report.title': 'सड़क सुरक्षा घटना की रिपोर्ट करें',
    'report.mode': 'आप किस रूप में रिपोर्ट कर रहे हैं',
    'report.type': 'घटना प्रकार',
    'report.severity': 'गंभीरता',
    'report.consent': 'इस गुमनाम रिपोर्ट को सुरक्षा अनुसंधान में उपयोग करने दें',
    'analytics.title': 'शहरी गतिशीलता सुरक्षा विश्लेषण',
    'common.loading': 'लोड हो रहा है…',
  },
  es: {
    'brand.tagline': 'Plataforma de seguridad para movilidad urbana',
    'nav.report': '+ Reportar incidente',
    'nav.signin': 'Iniciar sesión',
    'nav.map': 'Mapa',
    'nav.analytics': 'Análisis',
    'report.title': 'Reportar un incidente de seguridad vial',
    'report.mode': 'Estás reportando como',
    'report.type': 'Tipo de incidente',
    'report.severity': 'Gravedad',
    'report.consent': 'Permitir el uso anónimo de este reporte para investigación',
    'analytics.title': 'Análisis de seguridad de movilidad urbana',
    'common.loading': 'Cargando…',
  },
};

let currentLocale = pickInitialLocale();

function pickInitialLocale() {
  const stored = typeof localStorage !== 'undefined' && localStorage.getItem('alertcycle-locale');
  if (stored && MESSAGES[stored]) return stored;
  const nav = typeof navigator !== 'undefined' && navigator.language?.split('-')[0];
  if (nav && MESSAGES[nav]) return nav;
  return 'en';
}

export function setLocale(locale) {
  if (!MESSAGES[locale]) return false;
  currentLocale = locale;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('alertcycle-locale', locale);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  return true;
}

export function getLocale() {
  return currentLocale;
}

export function availableLocales() {
  return Object.keys(MESSAGES);
}

export function t(key) {
  return MESSAGES[currentLocale]?.[key] ?? MESSAGES.en[key] ?? key;
}
