import type { Condition, ConditionGroup } from "./definition";
import { type RenderOptions, renderValue, resolvePath } from "./render";

const DAY_MS = 86_400_000;

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const same = (left: unknown, right: unknown) => {
  if (isEmpty(left) && isEmpty(right)) return true;
  if (typeof left === "number" || typeof right === "number") {
    return Number(left) === Number(right);
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.toLowerCase() === right.toLowerCase();
  }
  return JSON.stringify(left) === JSON.stringify(right);
};

const time = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return Number.NaN;
  return new Date(value).getTime();
};

const contains = (haystack: unknown, needle: unknown) => {
  if (Array.isArray(haystack))
    return haystack.some((item) => same(item, needle));
  if (typeof haystack !== "string") return false;
  return haystack.toLowerCase().includes(String(needle ?? "").toLowerCase());
};

const list = (value: unknown) =>
  Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim())
      : [value];

/**
 * One condition against the run's scope. `changed` compares a field with `previous.<field>`, which an
 * update's trigger sets; values may be templates, such as `{{proposal.sent_at}}`.
 */
export function holds(
  condition: Condition,
  scope: Record<string, unknown>,
  options: RenderOptions,
): boolean {
  const actual = resolvePath(scope, condition.field);
  const expected = renderValue(condition.value, scope, options);
  switch (condition.op) {
    case "is":
      return same(actual, expected);
    case "is_not":
      return !same(actual, expected);
    case "in":
      return list(expected).some((item) => same(actual, item));
    case "not_in":
      return !list(expected).some((item) => same(actual, item));
    case "contains":
      return contains(actual, expected);
    case "not_contains":
      return !contains(actual, expected);
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    case "changed": {
      const field = condition.field.replace(/^record\./, "");
      const previous = scope.previous as Record<string, unknown> | undefined;
      return Boolean(previous) && !same(resolvePath(previous, field), actual);
    }
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "before":
      return time(actual) < time(expected);
    case "after":
      return time(actual) > time(expected);
    case "older_than_days":
      return time(actual) < Date.now() - Number(expected) * DAY_MS;
    case "newer_than_days":
      return time(actual) >= Date.now() - Number(expected) * DAY_MS;
  }
}

/** All or any of a group. An empty group always holds. */
export function groupHolds(
  group: ConditionGroup | undefined,
  scope: Record<string, unknown>,
  options: RenderOptions,
): boolean {
  if (!group || group.conditions.length === 0) return true;
  const results = group.conditions.map((condition) =>
    holds(condition, scope, options),
  );
  return group.match === "any" ? results.some(Boolean) : results.every(Boolean);
}
