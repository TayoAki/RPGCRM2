import {
  and,
  asc,
  type Column,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

/**
 * Atomic CRM's list filters, translated to SQL.
 *
 * The screens were written for PostgREST through ra-data-postgrest, so a filter is an object of
 * `column@operator` keys (`last_seen@gte`, `tags@cs`, `id@in`), plain `column` keys for equality, and
 * an `@or` group of the same. Only a resource's own columns may be named; anything else is refused,
 * which keeps a filter from ever reaching SQL as text.
 */

export class CrmQueryError extends Error {}

export type Columns = Record<string, Column>;

export type ListQuery = {
  where: SQL | undefined;
  orderBy: SQL[];
  limit: number;
  offset: number;
};

export const MAX_PAGE_SIZE = 5000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// PostgREST lists: `(1,2)` for `in`, `{a,"b c"}` for arrays. Quotes group, commas separate.
export function parseList(text: string): (string | number)[] {
  const items: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of text) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      items.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) items.push(current);
  return items.map((item) => {
    const number = Number(item);
    return item.trim() !== "" && Number.isFinite(number) ? number : item;
  });
}

function listValue(value: unknown, open: string, close: string) {
  if (Array.isArray(value)) return value as (string | number)[];
  if (
    typeof value !== "string" ||
    !value.startsWith(open) ||
    !value.endsWith(close)
  ) {
    throw new CrmQueryError(`Expected a list written ${open}…${close}.`);
  }
  return parseList(value.slice(1, -1));
}

function likePattern(word: string) {
  return `%${word.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

// One key of a filter, as conditions its group joins: AND at the top, OR inside `@or`.
function conditions(columns: Columns, key: string, value: unknown): SQL[] {
  if (key === "@or" || key === "@and") {
    if (!isRecord(value) || Object.keys(value).length === 0) {
      throw new CrmQueryError(`${key} needs an object of filters.`);
    }
    const parts = Object.entries(value).flatMap(([innerKey, innerValue]) =>
      conditions(columns, innerKey, innerValue),
    );
    const joined = key === "@or" ? or(...parts) : and(...parts);
    return joined ? [joined] : [];
  }

  const at = key.indexOf("@");
  const field = at === -1 ? key : key.slice(0, at);
  const operator = at === -1 ? undefined : key.slice(at + 1);
  const column = columns[field];
  if (!column) throw new CrmQueryError(`Unknown field: ${field}`);

  switch (operator) {
    case undefined:
      if (value === null) return [isNull(column)];
      if (Array.isArray(value)) {
        return [value.length ? inArray(column, value) : sql`false`];
      }
      return [eq(column, value)];
    case "eq":
      return [eq(column, value)];
    case "neq":
      return [ne(column, value)];
    case "lt":
      return [lt(column, value)];
    case "lte":
      return [lte(column, value)];
    case "gt":
      return [gt(column, value)];
    case "gte":
      return [gte(column, value)];
    case "is":
    case "not.is": {
      const negate = operator === "not.is";
      if (value === null || value === "null") {
        return [negate ? isNotNull(column) : isNull(column)];
      }
      if (
        value === true ||
        value === "true" ||
        value === false ||
        value === "false"
      ) {
        const flag = value === true || value === "true";
        return [negate ? ne(column, flag) : eq(column, flag)];
      }
      throw new CrmQueryError(`${key} takes null, true or false.`);
    }
    case "in": {
      const list = listValue(value, "(", ")");
      return [list.length ? inArray(column, list) : sql`false`];
    }
    case "cs":
      return [sql`${column} @> ${sql.param(listValue(value, "{", "}"))}`];
    case "ov":
      return [sql`${column} && ${sql.param(listValue(value, "{", "}"))}`];
    case "ilike": {
      // As ra-data-postgrest does: one condition per word, so on its own every word must match and
      // inside an @or group any word in any column will do.
      return String(value)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => sql`${column}::text ilike ${likePattern(word)}`);
    }
    default:
      throw new CrmQueryError(`Unknown operator: ${operator}`);
  }
}

export function whereOf(columns: Columns, filter: unknown): SQL | undefined {
  if (filter === undefined || filter === null) return undefined;
  if (!isRecord(filter)) throw new CrmQueryError("A filter must be an object.");
  const parts = Object.entries(filter).flatMap(([key, value]) =>
    conditions(columns, key, value),
  );
  return parts.length ? and(...parts) : undefined;
}

export type ListParams = {
  filter?: unknown;
  sort?: string | null;
  order?: string | null;
  page?: number | string | null;
  perPage?: number | string | null;
};

// The list parameters of a URL, as react-admin's data provider sends them.
export function listParamsFrom(search: URLSearchParams): ListParams {
  try {
    return {
      filter: JSON.parse(search.get("filter") ?? "{}"),
      sort: search.get("sort"),
      order: search.get("order"),
      page: search.get("page"),
      perPage: search.get("perPage"),
    };
  } catch {
    throw new CrmQueryError("The filter is not valid JSON.");
  }
}

const whole = (value: number | string | null | undefined, fallback: number) =>
  Number.parseInt(String(value ?? fallback), 10) || fallback;

export function listQuery(columns: Columns, params: ListParams): ListQuery {
  const orderBy: SQL[] = [];
  if (params.sort) {
    const column = columns[params.sort];
    if (!column) throw new CrmQueryError(`Unknown sort field: ${params.sort}`);
    orderBy.push(
      params.order?.toUpperCase() === "DESC"
        ? sql`${column} desc nulls last`
        : asc(column),
    );
  }

  const page = Math.max(1, whole(params.page, 1));
  const perPage = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, whole(params.perPage, 25)),
  );

  return {
    where: whereOf(columns, params.filter),
    orderBy,
    limit: perPage,
    offset: (page - 1) * perPage,
  };
}
