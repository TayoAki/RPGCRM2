import type { FieldDefinition, FieldType } from "../types";
import { filterKey } from "./model";

export type Operator =
  | "is"
  | "is_not"
  | "contains"
  | "has"
  | "at_least"
  | "at_most"
  | "empty"
  | "not_empty";

export type FilterRow = { field: string; op: Operator; value: unknown };

export const OPERATOR_LABELS: Record<Operator, string> = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  has: "has",
  at_least: "is at least",
  at_most: "is at most",
  empty: "is empty",
  not_empty: "is not empty",
};

const ORDERED = ["at_least", "at_most"] as const;

export function operatorsFor(type: FieldType): Operator[] {
  switch (type) {
    case "number":
    case "currency":
    case "rating":
      return ["is", ...ORDERED, "empty", "not_empty"];
    case "date":
    case "datetime":
      return [...ORDERED, "empty", "not_empty"];
    case "boolean":
      return ["is"];
    case "select":
    case "relation":
      return ["is", "is_not", "empty", "not_empty"];
    case "multi_select":
      return ["has", "empty", "not_empty"];
    default:
      return ["contains", "is", "is_not", "empty", "not_empty"];
  }
}

export const needsValue = (op: Operator) =>
  op !== "empty" && op !== "not_empty";

const SUFFIX: Record<Operator, string> = {
  is: "",
  is_not: "@neq",
  contains: "@ilike",
  has: "@cs",
  at_least: "@gte",
  at_most: "@lte",
  empty: "@is",
  not_empty: "@not.is",
};

const OPERATOR_OF = Object.fromEntries(
  Object.entries(SUFFIX).map(([op, suffix]) => [suffix, op as Operator]),
) as Record<string, Operator>;

/** Filter rows as the API's filter object (the same language the CRM's own lists use). */
export function filterOf(
  rows: FilterRow[],
  fields: FieldDefinition[],
  custom: boolean,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  for (const row of rows) {
    const field = fields.find((each) => each.name === row.field);
    if (!field) continue;
    if (needsValue(row.op) && (row.value === "" || row.value == null)) continue;
    const key = `${filterKey(field, custom)}${SUFFIX[row.op]}`;
    filter[key] = !needsValue(row.op)
      ? null
      : row.op === "has"
        ? `{${JSON.stringify(String(row.value))}}`
        : row.value;
  }
  return filter;
}

/** A saved filter back as rows, for editing. Keys this screen doesn't write are dropped. */
export function rowsOf(
  filter: Record<string, unknown> | undefined,
  fields: FieldDefinition[],
  custom: boolean,
): FilterRow[] {
  return Object.entries(filter ?? {}).flatMap(([key, raw]) => {
    const at = key.indexOf("@");
    const name = at === -1 ? key : key.slice(0, at);
    const op = OPERATOR_OF[at === -1 ? "" : key.slice(at)];
    const field = fields.find((each) => filterKey(each, custom) === name);
    if (!field || !op) return [];
    const value =
      op === "has" && typeof raw === "string"
        ? raw.replace(/^\{"?|"?\}$/g, "")
        : raw;
    return [{ field: field.name, op, value }];
  });
}
