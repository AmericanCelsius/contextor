import path from "node:path";

import { FileCandidate } from "./types";
import { extractKeywords, overlapRatio } from "../utils/text";

export function scoreFileCandidate(candidate: FileCandidate, goal: string): number {
  const now = Date.now();
  const ageHours = Math.max(1, (now - candidate.modifiedTimeMs) / (1000 * 60 * 60));
  const recencyScore = Math.max(0, 28 - Math.log2(ageHours) * 4);

  const goalKeywords = extractKeywords(goal);
  const filenameText = `${candidate.name} ${path.dirname(candidate.path)}`;
  const overlap = goalKeywords.length === 0 ? 0 : overlapRatio(filenameText, goal) * 34;

  const preferredExtensionBonus = [".md", ".txt", ".pdf", ".docx"].includes(candidate.extension) ? 8 : 4;
  const sizePenalty = candidate.size > 6_000_000 ? 8 : 0;

  return Number((recencyScore + overlap + preferredExtensionBonus - sizePenalty).toFixed(2));
}

export function suppressDuplicateCandidates<T extends { path: string; extractedText?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${path.basename(item.path).toLowerCase()}::${(item.extractedText ?? "").slice(0, 400).toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
