import { RedactionConfig } from "./types";

const TOKEN_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:sk|pk|rk|ghp|github_pat)_[a-zA-Z0-9_]{8,}\b/g, "[REDACTED_TOKEN]"],
  [/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\b/g, "[REDACTED_JWT]"],
  [/\bBearer\s+[a-zA-Z0-9\-._~+/=]+\b/gi, "Bearer [REDACTED_TOKEN]"],
  [/\b[a-f0-9]{32,}\b/gi, "[REDACTED_SECRET]"],
];

export function applyRedactions(input: string, config: RedactionConfig): string {
  if (!config.enabled) {
    return input;
  }

  let redacted = input;

  if (config.maskTokens) {
    for (const [pattern, replacement] of TOKEN_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
  }

  if (config.maskCookies) {
    redacted = redacted.replace(/(?:cookie|set-cookie)\s*:\s*[^\n]+/gi, "[REDACTED_COOKIE_HEADER]");
  }

  if (config.maskEmails) {
    redacted = redacted.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]");
  }

  return redacted;
}
