export function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function extractKeywords(input: string): string[] {
  return Array.from(
    new Set(
      normalizeWhitespace(input)
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 3),
    ),
  );
}

export function overlapRatio(left: string, right: string): number {
  const a = new Set(extractKeywords(left));
  const b = new Set(extractKeywords(right));

  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(a.size, b.size);
}

export function splitIntoSentences(input: string): string[] {
  return normalizeWhitespace(input)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

export function summarizeText(input: string, maxSentences = 3): string {
  const sentences = splitIntoSentences(input);
  if (sentences.length === 0) {
    return "No text extracted.";
  }

  const selected = sentences.filter((sentence) => sentence.length > 20).slice(0, maxSentences);
  return truncate(selected.join(" "), 420);
}

export function extractKeyPoints(input: string, limit = 5): string[] {
  const lines = input
    .split(/\r?\n/g)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 18);

  const sentenceFallback = splitIntoSentences(input)
    .filter((sentence) => sentence.length >= 24)
    .slice(0, limit);

  const pool = lines.length > 0 ? lines : sentenceFallback;

  return Array.from(new Set(pool.map((value) => truncate(value, 180)))).slice(0, limit);
}

export function fingerprint(input: string): string {
  return normalizeWhitespace(input).toLowerCase().slice(0, 800);
}

export function slugify(input: string): string {
  const normalized = normalizeWhitespace(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "item";
}
