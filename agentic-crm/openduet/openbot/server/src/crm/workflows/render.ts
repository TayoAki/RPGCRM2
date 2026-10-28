/**
 * Filling `{{...}}` in an automation's text from what the run knows: `{{contact.first_name}}`,
 * `{{meeting.start_at | add_hours:-1 | datetime}}`, `{{owner.name | default:"the team"}}`.
 */

export type RenderOptions = { timezone: string; currency: string };

const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;
const WHOLE_TOKEN = /^\s*\{\{\s*([^}|]+?)\s*\}\}\s*$/;

/** A dotted path into the scope. Unknown parts are undefined, never an error. */
export function resolvePath(scope: unknown, path: string): unknown {
  let value: unknown = scope;
  for (const part of path.split(".")) {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value) && /^\d+$/.test(part)) {
      value = value[Number(part)];
    } else if (typeof value === "object") {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addTo =
  (unitMs: number) =>
  (value: unknown, argument?: string): unknown => {
    const date = asDate(value);
    const amount = Number(argument);
    if (!date || !Number.isFinite(amount)) return value;
    return new Date(date.getTime() + amount * unitMs).toISOString();
  };

type Filter = (
  value: unknown,
  argument: string | undefined,
  options: RenderOptions,
  scope: unknown,
) => unknown;

const format =
  (style: Intl.DateTimeFormatOptions): Filter =>
  (value, argument, options) => {
    const date = asDate(value);
    if (!date) return value;
    return new Intl.DateTimeFormat("en-US", {
      ...style,
      timeZone: argument || options.timezone,
    }).format(date);
  };

const FILTERS: Record<string, Filter> = {
  date: format({ year: "numeric", month: "long", day: "numeric" }),
  datetime: format({
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }),
  time: format({ hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
  weekday: format({ weekday: "long" }),
  add_minutes: addTo(60_000),
  add_hours: addTo(3_600_000),
  add_days: addTo(86_400_000),
  money: (value, argument, options) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: argument || options.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  },
  upper: (value) => (typeof value === "string" ? value.toUpperCase() : value),
  lower: (value) => (typeof value === "string" ? value.toLowerCase() : value),
  // default:"text", or default:other.field for another value.
  default: (value, argument, _options, scope) => {
    if (value !== undefined && value !== null && value !== "") return value;
    if (!argument) return "";
    const quoted = /^"(.*)"$/.exec(argument);
    if (quoted) return quoted[1];
    return resolvePath(scope, argument) ?? argument;
  },
};

function applyExpression(
  expression: string,
  scope: unknown,
  options: RenderOptions,
) {
  const [path = "", ...filters] = expression
    .split("|")
    .map((part) => part.trim());
  let value =
    path === "now"
      ? new Date().toISOString()
      : path === "today"
        ? new Date().toISOString().slice(0, 10)
        : resolvePath(scope, path);
  for (const filter of filters) {
    const match = /^([a-z_]+)(?::\s*(.*))?$/.exec(filter);
    const apply = match?.[1] ? FILTERS[match[1]] : undefined;
    const argument = match?.[2]?.trim();
    // Only default tells a quoted argument from a path; the rest want the bare text.
    if (apply) {
      value = apply(
        value,
        match?.[1] === "default"
          ? argument
          : argument?.replace(/^"(.*)"$/, "$1"),
        options,
        scope,
      );
    }
  }
  return value;
}

const asText = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
};

/** A template as text. */
export function renderText(
  template: string,
  scope: unknown,
  options: RenderOptions,
): string {
  return template.replace(TOKEN, (_, expression: string) =>
    asText(applyExpression(expression, scope, options)),
  );
}

/**
 * A value for a record's field: a template that is one `{{path}}` keeps its type (a number, a list,
 * an id), anything else becomes text, and non-strings pass through.
 */
export function renderValue(
  value: unknown,
  scope: unknown,
  options: RenderOptions,
): unknown {
  if (typeof value !== "string") {
    if (Array.isArray(value))
      return value.map((item) => renderValue(item, scope, options));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          renderValue(item, scope, options),
        ]),
      );
    }
    return value;
  }
  const whole = WHOLE_TOKEN.exec(value);
  if (whole?.[1]) return applyExpression(whole[1], scope, options);
  return renderText(value, scope, options);
}
