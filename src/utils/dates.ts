export function formatRunTimestamp(input: Date = new Date()): string {
  return input.toISOString().replace(/\.\d{3}Z$/, "").replace(/:/g, "-");
}

export function formatDisplayDate(input: Date | string | number): string {
  const value = new Date(input);
  return value.toLocaleString();
}

export function toIsoString(input: Date | string | number): string {
  return new Date(input).toISOString();
}
