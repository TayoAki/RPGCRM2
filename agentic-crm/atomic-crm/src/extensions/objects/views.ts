import { useQuery } from "@tanstack/react-query";

import { crmApi } from "../api";
import type { FieldDefinition, SavedView } from "../types";

export const viewsKey = (object: string) => ["crm", "views", object];

export const useViews = (object: string) =>
  useQuery({
    queryKey: viewsKey(object),
    queryFn: () =>
      crmApi<SavedView[]>(`/views?object=${encodeURIComponent(object)}`),
  });

// The fields that name a record; the table's first column already shows them.
const TITLE_FIELDS: Record<string, string[]> = {
  contacts: ["first_name", "last_name"],
  tasks: ["text"],
  meetings: ["title"],
  proposals: ["title"],
};

export const titleFields = (object: string) => TITLE_FIELDS[object] ?? ["name"];

const DEFAULT_COLUMNS = 6;

export const defaultColumns = (object: string, fields: FieldDefinition[]) =>
  fields
    .filter(
      (field) =>
        !titleFields(object).includes(field.name) && field.type !== "long_text",
    )
    .slice(0, DEFAULT_COLUMNS)
    .map((field) => field.name);

// Standard objects with their own create screens in the CRM.
export const CREATE_PAGES: Record<string, string> = {
  contacts: "/contacts/create",
  companies: "/companies/create",
  deals: "/deals/create",
};
