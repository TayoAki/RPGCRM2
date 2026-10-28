import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { FieldDefinition } from "../types";
import { titleOf, useRecordChoices } from "./model";

const EMPTY = "__empty__";

const localDateTime = (value: unknown) => {
  if (typeof value !== "string" || !value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const RelationInput = ({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const [search, setSearch] = useState("");
  const target = field.options.target;
  const { data: choices = [] } = useRecordChoices(target, search);
  return (
    <div className="flex flex-col gap-1">
      <Input
        aria-label={`Find a record for ${field.label}`}
        placeholder="Type to find…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <Select
        value={value == null ? EMPTY : String(value)}
        onValueChange={(next) => onChange(next === EMPTY ? null : Number(next))}
      >
        <SelectTrigger aria-label={field.label}>
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY}>None</SelectItem>
          {value != null && !choices.some((choice) => choice.id === value) ? (
            <SelectItem value={String(value)}>#{String(value)}</SelectItem>
          ) : null}
          {choices.map((choice) => (
            <SelectItem key={String(choice.id)} value={String(choice.id)}>
              {titleOf(target ?? "", choice)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/** An input for a field of any type, given its value and a way to change it. */
export const FieldInput = ({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const text = value === null || value === undefined ? "" : String(value);
  switch (field.type) {
    case "long_text":
      return (
        <Textarea
          aria-label={field.label}
          rows={4}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "number":
    case "currency":
      return (
        <Input
          aria-label={field.label}
          type="number"
          value={text}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
      );
    case "rating":
      return (
        <Select
          value={text || EMPTY}
          onValueChange={(next) =>
            onChange(next === EMPTY ? null : Number(next))
          }
        >
          <SelectTrigger aria-label={field.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>No rating</SelectItem>
            {[1, 2, 3, 4, 5].map((stars) => (
              <SelectItem key={stars} value={String(stars)}>
                {"★".repeat(stars)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "date":
      return (
        <Input
          aria-label={field.label}
          type="date"
          value={text.slice(0, 10)}
          onChange={(event) => onChange(event.target.value || null)}
        />
      );
    case "datetime":
      return (
        <Input
          aria-label={field.label}
          type="datetime-local"
          value={localDateTime(value)}
          onChange={(event) =>
            onChange(
              event.target.value
                ? new Date(event.target.value).toISOString()
                : null,
            )
          }
        />
      );
    case "boolean":
      return (
        <Checkbox
          aria-label={field.label}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      );
    case "select":
      return (
        <Select
          value={text || EMPTY}
          onValueChange={(next) => onChange(next === EMPTY ? null : next)}
        >
          <SelectTrigger aria-label={field.label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>None</SelectItem>
            {(field.options.choices ?? []).map((choice) => (
              <SelectItem key={choice.value} value={choice.value}>
                {choice.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi_select": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div
          className="flex flex-col gap-1"
          role="group"
          aria-label={field.label}
        >
          {(field.options.choices ?? []).map((choice) => (
            <label
              key={choice.value}
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox
                checked={selected.includes(choice.value)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...selected, choice.value]
                      : selected.filter((each) => each !== choice.value),
                  )
                }
              />
              {choice.label}
            </label>
          ))}
        </div>
      );
    }
    case "relation":
      return <RelationInput field={field} value={value} onChange={onChange} />;
    default:
      return (
        <Input
          aria-label={field.label}
          type={
            field.type === "email"
              ? "email"
              : field.type === "url"
                ? "url"
                : "text"
          }
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
};
