type Level = "info" | "warn" | "error";

export function log(
  level: Level,
  event: string,
  data: Record<string, unknown> = {},
) {
  const line = { level, event, ...data };
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
