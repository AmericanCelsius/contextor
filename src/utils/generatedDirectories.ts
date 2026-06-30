import { GeneratedDirectoryOmitPreset } from "../core/types";

const PYTHON_GENERATED_DIRS = [
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  ".nox",
  ".venv",
  "venv",
];

const NODE_GENERATED_DIRS = [
  "node_modules",
  ".next",
  ".nuxt",
  ".cache",
  ".parcel-cache",
  ".turbo",
  "coverage",
  "dist",
  "build",
];

const COMPILED_GENERATED_DIRS = [
  ".gradle",
  "target",
  "out",
  "bin",
  "obj",
  ".dart_tool",
  ".stack-work",
];

export const GENERATED_DIRECTORY_OMIT_PRESETS: Record<GeneratedDirectoryOmitPreset, string[]> = {
  common: [...PYTHON_GENERATED_DIRS, ...NODE_GENERATED_DIRS, ...COMPILED_GENERATED_DIRS, "tmp", "temp", ".tmp"],
  python: PYTHON_GENERATED_DIRS,
  node: NODE_GENERATED_DIRS,
  compiled: COMPILED_GENERATED_DIRS,
  none: [],
};

export function normalizeGeneratedDirectoryOmitPreset(value: string | undefined): GeneratedDirectoryOmitPreset {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "python" || normalized === "node" || normalized === "compiled" || normalized === "none") {
    return normalized;
  }

  return "common";
}

export function getGeneratedDirectoryOmitNames(preset: GeneratedDirectoryOmitPreset | undefined): string[] {
  return [...GENERATED_DIRECTORY_OMIT_PRESETS[preset ?? "common"]];
}

export function describeGeneratedDirectoryOmitPreset(preset: GeneratedDirectoryOmitPreset | undefined): string {
  const normalized = preset ?? "common";
  if (normalized === "none") {
    return "No generated/cache directory omission is active.";
  }

  return `${normalized} (${getGeneratedDirectoryOmitNames(normalized).join(", ")})`;
}
