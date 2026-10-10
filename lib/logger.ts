// Structured, secret-safe server logging (MSG-29).
// One JSON object per line on stdout/stderr, so any log collector (Docker, Vercel, Loki, ...) can
// parse and search it. Never pass raw request headers, cookies or env values in `fields`.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = (process.env.LOG_LEVEL as Level) in LEVELS ? (process.env.LOG_LEVEL as Level) : "info";

// Keys whose values are always hidden, at any depth.
const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|session|jwt|dsn|credential/i;
// Values that look like secrets even under an innocent key.
const SECRET_VALUES = [
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, // Supabase keys
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, // JWTs
];
// Keeps the connection string readable but drops its password: postgres://user:****@host
const CONNECTION_PASSWORD = /(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/g;

function redactString(value: string) {
  const withoutPasswords = value.replace(CONNECTION_PASSWORD, "$1[REDACTED]@");
  return SECRET_VALUES.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), withoutPasswords);
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Truncated]";
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), stack: value.stack && redactString(value.stack) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1)]),
    );
  }
  return value;
}

function write(level: Level, message: string, fields?: Fields) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: redactString(message),
    ...(fields ? (redact(fields) as Fields) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
