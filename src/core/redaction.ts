import { RedactionConfig } from "./types";

const SECRET_KEY_PATTERN =
  /(?:api[_-]?key|access[_-]?key|secret[_-]?key|token|secret|password|passwd|pass|pwd|username|user|email|auth|credential|credentials|private[_-]?key|client[_-]?secret|database[_-]?url|db[_-]?password|connection[_-]?string)/i;

const TOKEN_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:sk|pk|rk|ghp|github_pat)_[a-zA-Z0-9_]{8,}\b/g, "[REDACTED_TOKEN]"],
  [/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+\b/g, "[REDACTED_JWT]"],
  [/\bBearer\s+[a-zA-Z0-9\-._~+/=]+\b/gi, "Bearer [REDACTED_TOKEN]"],
  [/\b[a-f0-9]{32,}\b/gi, "[REDACTED_SECRET]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
];

export function applyRedactions(input: string, config: RedactionConfig): string {
  if (!config.enabled) {
    return input;
  }

  let redacted = input;

  redacted = redactSecretAssignments(redacted);

  if (config.maskTokens) {
    for (const [pattern, replacement] of TOKEN_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
  }

  if (config.maskCookies) {
    redacted = redacted.replace(/(?:cookie|set-cookie)\s*:\s*[^\n]+/gi, "[REDACTED_COOKIE_HEADER]");
  }

  if (config.maskEmails) {
    redacted = redactEmailAddresses(redacted);
  }

  return redacted;
}

export function applyDefaultSecretRedactions(input: string): string {
  return applyRedactions(input, {
    enabled: true,
    maskEmails: true,
    maskTokens: true,
    maskCookies: true,
    maxExcerptLength: 2400,
  });
}

function redactSecretAssignments(input: string): string {
  const quotedAssignmentPattern =
    /(^|[\s,{\[])(["']?)([A-Z0-9_.-]+)(\2)(\s*[:=]\s*)(["'`])([^"'`\r\n]*)(\6)/gim;
  const unquotedAssignmentPattern =
    /(^|[\s,{\[])(["']?)([A-Z0-9_.-]+)(\2)(\s*[:=]\s*)([^\s,}\]\r\n#"'`]+)/gim;

  const redactQuoted = input.replace(
    quotedAssignmentPattern,
    (match: string, prefix: string, keyQuote: string, key: string, closingKeyQuote: string, separator: string, valueQuote: string, value: string, closingValueQuote: string) => {
      if (!SECRET_KEY_PATTERN.test(key)) {
        return match;
      }

      return `${prefix}${keyQuote}${key}${closingKeyQuote}${separator}${valueQuote}${maskSecretValue(value)}${closingValueQuote}`;
    },
  );

  return redactQuoted.replace(
    unquotedAssignmentPattern,
    (match: string, prefix: string, keyQuote: string, key: string, closingKeyQuote: string, separator: string, value: string) => {
      if (!SECRET_KEY_PATTERN.test(key)) {
        return match;
      }

      return `${prefix}${keyQuote}${key}${closingKeyQuote}${separator}${maskSecretValue(value)}`;
    },
  );
}

function redactEmailAddresses(input: string): string {
  return input.replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, (_match, domain: string) => {
    return `${"*".repeat(7)}@${domain}`;
  });
}

function maskSecretValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "********";
  }

  const emailMatch = trimmed.match(/^[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})$/i);
  if (emailMatch?.[1]) {
    return `${"*".repeat(Math.max(7, Math.min(16, trimmed.length - emailMatch[1].length - 1)))}@${emailMatch[1]}`;
  }

  const length = Math.max(8, Math.min(24, trimmed.length));
  return "*".repeat(length);
}
