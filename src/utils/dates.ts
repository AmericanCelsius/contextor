export function formatRunTimestamp(input: Date | string | number = new Date()): string {
  return new Date(input).toISOString().replace(/\.\d{3}Z$/, "").replace(/:/g, "-");
}

export function formatDisplayDate(input: Date | string | number): string {
  const value = new Date(input);
  return value.toLocaleString();
}

export function toIsoString(input: Date | string | number): string {
  return new Date(input).toISOString();
}
