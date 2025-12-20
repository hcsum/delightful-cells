import { STATE_ABBR, STATE_NAME_TO_ABBR } from './usStates'

// Basic client-side extractors for preview only. These are not AI, just heuristics.

export function extractStateFromAddress(input: string): string | null {
  if (!input) return null;
  const text = String(input);
  // 1) Look for 2-letter uppercase abbreviations surrounded by word boundaries
  const abbrMatch = text.match(/\b([A-Z]{2})\b/);
  if (abbrMatch) {
    const maybe = abbrMatch[1].toUpperCase();
    if (STATE_ABBR.has(maybe)) return maybe;
  }
  // 2) Look for state names
  const lower = text.toLowerCase();
  const names = Object.keys(STATE_NAME_TO_ABBR).sort((a,b) => b.length - a.length);
  for (const name of names) {
    if (lower.includes(name)) return STATE_NAME_TO_ABBR[name];
  }
  return null;
}

export function extractCityFromAddress(input: string): string | null {
  if (!input) return null;
  // Heuristic: Capture city before state abbreviation if formatted like "City, ST" or "City ST"
  const text = String(input);
  const cityAbbr = text.match(/\b([A-Za-z .'-]{2,}),?\s+([A-Z]{2})\b/);
  if (cityAbbr) {
    return cityAbbr[1].trim();
  }
  // Fallback: take first token before comma as city-like
  const firstComma = text.split(',')[0];
  if (firstComma && /[A-Za-z]/.test(firstComma)) return firstComma.trim();
  return null;
}

export function extractNumbersFromText(input: string): string | null {
  if (!input) return null;
  const nums = String(input).match(/[0-9]+(?:\.[0-9]+)?/g);
  return nums ? nums.join(' ') : null;
}

export function extractTextFromCell(input: string): string | null {
  if (!input) return null;
  // For preview, just echo non-empty trimmed text
  const t = String(input).trim();
  return t.length ? t : null;
}

// Additional simple client-side heuristics (used only as a fallback if worker is unavailable)
export function extractZipFromAddress(input: string): string | null {
  if (!input) return null;
  const s = String(input);
  // US ZIP or ZIP+4
  const us = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (us) return us[0];
  // Canadian postal code (A1A 1A1)
  const ca = s.match(/\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d\b/i);
  if (ca) return ca[0].toUpperCase();
  return null;
}

export function extractFirstNameFromFullName(input: string): string | null {
  if (!input) return null;
  let s = String(input).trim();
  // Handle "Last, First ..."
  if (s.includes(',')) {
    const parts = s.split(',');
    const after = (parts[1] || '').trim();
    const first = after.split(/\s+/)[0];
    return first || null;
  }
  // Remove common titles
  s = s.replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|sir|madam)\s+/i, '');
  const first = s.split(/\s+/)[0];
  return first || null;
}

export function extractLastNameFromFullName(input: string): string | null {
  if (!input) return null;
  let s = String(input).trim();
  // Handle "Last, First ..."
  if (s.includes(',')) {
    const parts = s.split(',');
    const last = (parts[0] || '').trim();
    return last || null;
  }
  // Strip suffixes
  s = s.replace(/\s+(jr\.?|sr\.?|ii|iii|iv|phd|md)$/i, '');
  const tokens = s.split(/\s+/);
  const last = tokens[tokens.length - 1];
  return last || null;
}

export function extractTitleFromName(input: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^(mr\.?|mrs\.?|ms\.?|dr\.?|prof\.?|sir|madam)\b/i);
  return m ? m[0].replace(/\.$/, '') : null;
}

export function extractDomainFromEmail(input: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const at = s.indexOf('@');
  if (at < 0) return null;
  const domain = s.slice(at + 1).replace(/[,;\s].*$/, '');
  return domain.toLowerCase() || null;
}

export function extractUsernameFromEmail(input: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const at = s.indexOf('@');
  if (at <= 0) return null;
  return s.slice(0, at) || null;
}

export function buildCustomExtractor(target: string, source: string) {
  // For preview only: naive keyword extraction, return substring around target keyword
  const t = (target || '').toLowerCase();
  const s = (source || '').toLowerCase();
  return (input: string) => {
    const txt = String(input);
    const lower = txt.toLowerCase();
    // try to find any word from target as a clue
    const words = t.split(/\s+/).filter(Boolean);
    for (const w of words) {
      const idx = lower.indexOf(w);
      if (idx >= 0) {
        // return a slice around the found word
        const start = Math.max(0, idx - 15);
        const end = Math.min(txt.length, idx + w.length + 15);
        return txt.slice(start, end).trim();
      }
    }
    // else return first 20 chars as a placeholder
    const trimmed = txt.trim();
    return trimmed ? trimmed.slice(0, 20) : null;
  };
}

export const PROMPTS = {
  state: `From the following address text, extract the US state as a two-letter abbreviation.\nIf no state is found, return null.`,
  city: `From the following address text, extract the city name.\nIf no city is found, return null.`,
  numbers: `From the following text, extract all numbers.\nIf none found, return null.`,
  text: `Return the text value of the cell if any meaningful text exists, else return null.`,
  zip: `From the following address text, extract the ZIP or postal code.\nIf not found, return null.`,
  firstName: `From the following full name, extract the first name.\nIf not found, return null.`,
  lastName: `From the following full name, extract the last name (surname).\nIf not found, return null.`,
  titleFromName: `From the following name, extract any honorific or title (e.g., Mr, Ms, Dr, Prof).\nIf not found, return null.`,
  domainFromEmail: `From the following email address, extract the domain.\nIf not found, return null.`,
  usernameFromEmail: `From the following email address, extract the username (local-part before @).\nIf not found, return null.`,
};
