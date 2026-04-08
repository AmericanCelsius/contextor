import { BrowserSource, ContextCompileInput, FileSource, RuntimeEnvironmentInfo } from "../core/types";
import { renderKeyValueBlock } from "../utils/markdown";

export function renderContextMarkdown(input: ContextCompileInput, runtimeInfo: RuntimeEnvironmentInfo): string {
  const executiveSummary = buildExecutiveSummary(input);
  const keyFindings = buildKeyFindings(input);
  const browserSection =
    input.browserSources.length === 0
      ? "_No browser sources captured for this run._"
      : input.browserSources.map((source, index) => renderBrowserSource(source, index + 1)).join("\n\n");
  const fileSection =
    input.fileSources.length === 0
      ? "_No local files compiled for this run._"
      : input.fileSources.map((source, index) => renderFileSource(source, index + 1)).join("\n\n");
  const communicationNotes =
    input.communicationNotes.length === 0
      ? "- None"
      : input.communicationNotes.map((note) => `- ${note}`).join("\n");
  const actionableNotes =
    input.actionableNotes.length === 0
      ? "- Review the source manifest and recent artifacts."
      : input.actionableNotes.map((note) => `- ${note}`).join("\n");

  return `# Task Goal

${input.goal}

# Executive Summary

${executiveSummary}

# Runtime Context

${renderRuntimeContext(runtimeInfo)}

# Key Findings

${keyFindings}

# Browser Sources

${browserSection}

# File Sources

${fileSection}

# Communication / Portal Notes

${communicationNotes}

# Actionable Notes for LLM

${actionableNotes}

# Source Manifest

- Workflow: ${input.workflow}
- Manifest file: manifests/sources.json
- Browser source count: ${input.browserSources.length}
- File source count: ${input.fileSources.length}
`;
}

function renderRuntimeContext(runtimeInfo: RuntimeEnvironmentInfo): string {
  const lines = [
    `- Local time: ${runtimeInfo.localTimestamp}`,
    `- UTC time: ${runtimeInfo.utcTimestamp}`,
    `- Time zone: ${runtimeInfo.timeZone}`,
  ];

  if (runtimeInfo.approximateLocation) {
    lines.push(`- Approximate location: ${runtimeInfo.approximateLocation}`);
  }

  if (runtimeInfo.approximateLocationNote) {
    lines.push(`- Location note: ${runtimeInfo.approximateLocationNote}`);
  }

  return lines.join("\n");
}

function buildExecutiveSummary(input: ContextCompileInput): string {
  const parts = [
    `Contextor compiled ${input.browserSources.length} browser source(s) and ${input.fileSources.length} file source(s).`,
  ];

  const topBrowserTitles = input.browserSources.slice(0, 3).map((source) => source.title);
  if (topBrowserTitles.length > 0) {
    parts.push(`Top browser captures: ${topBrowserTitles.join(", ")}.`);
  }

  const topFiles = input.fileSources.slice(0, 3).map((source) => source.name);
  if (topFiles.length > 0) {
    parts.push(`Top file candidates: ${topFiles.join(", ")}.`);
  }

  return parts.join(" ");
}

function buildKeyFindings(input: ContextCompileInput): string {
  const findings = [
    ...input.browserSources.slice(0, 5).map((source) => source.summary),
    ...input.fileSources.slice(0, 5).map((source) => `${source.name}: ${source.summary}`),
  ].filter(Boolean);

  if (findings.length === 0) {
    return "- No sources were captured.";
  }

  return findings.map((finding) => `- ${finding}`).join("\n");
}

function renderBrowserSource(source: BrowserSource, index: number): string {
  const artifactLines = Object.entries(source.artifacts)
    .map(([key, filePath]) => `- ${key}: ${filePath}`)
    .join("\n");

  return `## Source ${index}: ${source.title}

${renderKeyValueBlock({
    URL: source.url,
    Strategy: source.strategy,
    Captured: source.capturedAt,
  })}

### Summary

${source.summary}

### Key Points

${source.keyPoints.length === 0 ? "- None" : source.keyPoints.map((point) => `- ${point}`).join("\n")}

### Excerpt

\`\`\`text
${source.excerpt}
\`\`\`

### Artifacts

${artifactLines || "- None"}
`;
}

function renderFileSource(source: FileSource, index: number): string {
  return `## File ${index}: ${source.name}

${renderKeyValueBlock({
    Path: source.path,
    Extension: source.extension,
    Modified: source.modifiedTime,
    Size: `${source.size} bytes`,
    Relevance: source.score.toFixed(2),
  })}

### Summary

${source.summary}

### Key Points

${source.keyPoints.length === 0 ? "- None" : source.keyPoints.map((point) => `- ${point}`).join("\n")}

### Excerpt

\`\`\`text
${source.excerpt}
\`\`\`
`;
}
