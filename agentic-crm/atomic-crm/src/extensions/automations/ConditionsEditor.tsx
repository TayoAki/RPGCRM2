/* eslint-disable react-refresh/only-export-components */
import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Condition, ConditionGroup } from "../types";
import { OPERATORS } from "./describe";

export const FIELDS: Record<string, string[]> = {
  contacts: [
    "first_name",
    "last_name",
    "title",
    "status",
    "lifecycle_stage",
    "lead_source",
    "lead_source_detail",
    "background",
    "tags",
    "updated_at",
  ],
  companies: [
    "name",
    "sector",
    "website",
    "lifecycle_stage",
    "lead_source",
    "city",
    "country",
    "updated_at",
  ],
  deals: [
    "name",
    "stage",
    "amount",
    "categories",
    "lead_source",
    "expected_closing_date",
    "updated_at",
  ],
  meetings: [
    "title",
    "status",
    "outcome",
    "outcome_notes",
    "start_at",
    "source",
    "location",
  ],
  proposals: [
    "title",
    "status",
    "amount",
    "sent_at",
    "viewed_at",
    "accepted_at",
    "declined_at",
  ],
  tasks: ["text", "type", "due_date", "done_date"],
  emails: ["subject", "status", "direction", "to_address", "from_address"],
  contact_notes: ["text", "status"],
  deal_notes: ["text"],
};

const RELATED = [
  ["contact", "contacts"],
  ["company", "companies"],
  ["deal", "deals"],
  ["meeting", "meetings"],
  ["proposal", "proposals"],
] as const;

export const fieldSuggestions = (object: string | undefined) => [
  ...(object ? (FIELDS[object] ?? []).map((field) => `record.${field}`) : []),
  ...RELATED.flatMap(([prefix, table]) =>
    (FIELDS[table] ?? []).map((field) => `${prefix}.${field}`),
  ),
  "contact.email",
  "contact.last_email_received_at",
  "owner.first_name",
];

const asText = (value: unknown) =>
  value === undefined || value === null ? "" : String(value);

/** "All" or "any" of a few field comparisons. */
export const ConditionsEditor = ({
  value,
  onChange,
  object,
  emptyText = "Always",
}: {
  value: ConditionGroup | undefined;
  onChange: (value: ConditionGroup) => void;
  object?: string;
  emptyText?: string;
}) => {
  const group = value ?? { match: "all" as const, conditions: [] };
  const listId = useId();
  const setCondition = (index: number, next: Partial<Condition>) =>
    onChange({
      ...group,
      conditions: group.conditions.map((condition, at) =>
        at === index ? { ...condition, ...next } : condition,
      ),
    });

  return (
    <div className="flex flex-col gap-2">
      <datalist id={listId}>
        {fieldSuggestions(object).map((field) => (
          <option key={field} value={field} />
        ))}
      </datalist>
      {group.conditions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          Only if
          <Select
            value={group.match}
            onValueChange={(match) =>
              onChange({ ...group, match: match as "all" | "any" })
            }
          >
            <SelectTrigger className="w-24 h-8" aria-label="Match">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              <SelectItem value="any">any</SelectItem>
            </SelectContent>
          </Select>
          of these hold:
        </div>
      )}
      {group.conditions.map((condition, index) => {
        const needsValue =
          OPERATORS.find((op) => op.id === condition.op)?.needsValue ?? true;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: conditions have no ids; order is identity.
          <div key={index} className="flex gap-2 items-center">
            <Input
              list={listId}
              aria-label="Field"
              className="h-8"
              placeholder="record.stage"
              value={condition.field}
              onChange={(event) =>
                setCondition(index, { field: event.target.value })
              }
            />
            <Select
              value={condition.op}
              onValueChange={(op) => setCondition(index, { op })}
            >
              <SelectTrigger
                className="h-8 w-48 shrink-0"
                aria-label="Comparison"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsValue ? (
              <Input
                aria-label="Value"
                className="h-8"
                value={asText(condition.value)}
                onChange={(event) =>
                  setCondition(index, { value: event.target.value })
                }
              />
            ) : (
              <div className="flex-1" />
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove condition"
              onClick={() =>
                onChange({
                  ...group,
                  conditions: group.conditions.filter((_, at) => at !== index),
                })
              }
            >
              <X className="size-4" />
            </Button>
          </div>
        );
      })}
      <div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange({
              ...group,
              conditions: [
                ...group.conditions,
                { field: "", op: "is", value: "" },
              ],
            })
          }
        >
          <Plus className="size-4" /> Add a condition
        </Button>
      </div>
    </div>
  );
};
