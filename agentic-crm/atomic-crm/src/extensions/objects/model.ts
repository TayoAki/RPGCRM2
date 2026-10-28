import { useQuery } from "@tanstack/react-query";
import { useGetList } from "ra-core";

import { crmApi } from "../api";
import type { FieldDefinition, ObjectAccess, ObjectDefinition } from "../types";

export const metadataKey = ["crm", "metadata"];

export const useMetadata = () =>
  useQuery({
    queryKey: metadataKey,
    queryFn: () =>
      crmApi<{ objects: ObjectDefinition[]; fields: FieldDefinition[] }>(
        "/metadata",
      ),
    staleTime: 30_000,
  });

export const useAccess = () =>
  useQuery({
    queryKey: ["crm", "access"],
    queryFn: () =>
      crmApi<{ full: boolean; objects: Record<string, ObjectAccess> }>(
        "/me/access",
      ),
    staleTime: 60_000,
  });

/** An object's description and fields, standard first, as the API returns them. */
export const useObject = (name: string | undefined) => {
  const { data, ...query } = useMetadata();
  const object = data?.objects.find((each) => each.name === name);
  const fields = (data?.fields ?? []).filter((field) => field.object === name);
  return { ...query, object, fields };
};

// Standard objects have their own screens; these are their addresses.
const STANDARD_PAGES: Record<string, (id: unknown) => string> = {
  contacts: (id) => `/contacts/${id}/show`,
  companies: (id) => `/companies/${id}/show`,
  deals: (id) => `/deals/${id}/show`,
};

export const recordPath = (object: string, id: unknown) =>
  STANDARD_PAGES[object]?.(id) ?? `/o/${object}/${id}`;

/** How a record is named in lists and links. */
export function titleOf(
  object: string,
  record: Record<string, unknown> | undefined,
): string {
  if (!record) return "";
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  if (object === "contacts" || object === "sales") {
    return (
      [text(record.first_name), text(record.last_name)]
        .filter(Boolean)
        .join(" ") || `#${record.id}`
    );
  }
  return (
    text(record.name) ||
    text(record.title) ||
    text(record.text) ||
    `#${record.id}`
  );
}

/** A field's value on a record: standard fields are columns, custom ones live in custom_fields. */
export function valueOf(
  record: Record<string, unknown>,
  field: FieldDefinition,
  custom: boolean,
) {
  if (custom || field.standard) return record[field.name];
  const bag = record.custom_fields as Record<string, unknown> | undefined;
  return bag?.[field.name];
}

/** The key a filter or sort names for a field. */
export const filterKey = (field: FieldDefinition, custom: boolean) =>
  custom || field.standard ? field.name : `custom_fields.${field.name}`;

/** A filter that finds records of an object by the words people would type for them. */
export function searchFilter(
  object: string,
  text: string,
): Record<string, unknown> {
  const words = text.trim();
  if (!words) return {};
  if (object === "contacts" || object === "sales") {
    return { "@or": { "first_name@ilike": words, "last_name@ilike": words } };
  }
  if (object === "tasks") return { "text@ilike": words };
  if (object === "meetings" || object === "proposals")
    return { "title@ilike": words };
  return { "name@ilike": words };
}

export const isCustomObject = (object: { standard: boolean } | undefined) =>
  Boolean(object && !object.standard);

/** The body that sets these fields' values: custom fields of a standard object go in custom_fields. */
export function bodyOf(
  fields: FieldDefinition[],
  values: Record<string, unknown>,
  custom: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const bag: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field.name in values)) continue;
    if (custom || field.standard) body[field.name] = values[field.name];
    else bag[field.name] = values[field.name];
  }
  return Object.keys(bag).length ? { ...body, custom_fields: bag } : body;
}

/** Records of an object to pick from, by name. */
export const useRecordChoices = (target: string | undefined, search: string) =>
  useGetList(
    target ?? "contacts",
    {
      pagination: { page: 1, perPage: 25 },
      filter: searchFilter(target ?? "", search),
    },
    { enabled: Boolean(target) },
  );

export const historyKey = (object: string, id: unknown) => [
  "crm",
  "history",
  object,
  String(id),
];
