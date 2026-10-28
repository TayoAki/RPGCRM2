import { Filter, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { FieldDefinition } from "../types";
import { FieldInput } from "./FieldInput";
import {
  type FilterRow,
  needsValue,
  OPERATOR_LABELS,
  type Operator,
  operatorsFor,
} from "./filters";

const blankRow = (field: FieldDefinition): FilterRow => ({
  field: field.name,
  op: operatorsFor(field.type)[0],
  value: field.type === "boolean" ? true : null,
});

type FilterEditorProps = {
  fields: FieldDefinition[];
  rows: FilterRow[];
  onChange: (rows: FilterRow[]) => void;
};

/** The filters on a list: one row per condition, all of which must hold. */
export const FilterEditor = ({ fields, rows, onChange }: FilterEditorProps) => {
  const change = (index: number, row: FilterRow) =>
    onChange(rows.map((each, at) => (at === index ? row : each)));
  const add = () => {
    const field = fields[0];
    if (field) {
      onChange([...rows, blankRow(field)]);
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="size-4" />
          Filter{rows.length ? ` (${rows.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(36rem,95vw)]">
        <div className="flex flex-col gap-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No filters. Every record is shown.
            </p>
          ) : null}
          {rows.map((row, index) => {
            const field = fields.find((each) => each.name === row.field);
            if (!field) return null;
            return (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[10rem_8rem_1fr_auto] gap-2 items-start"
              >
                <Select
                  value={row.field}
                  onValueChange={(name) => {
                    const next = fields.find((each) => each.name === name);
                    if (next) {
                      change(index, blankRow(next));
                    }
                  }}
                >
                  <SelectTrigger aria-label="Field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((each) => (
                      <SelectItem key={each.name} value={each.name}>
                        {each.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={row.op}
                  onValueChange={(op) =>
                    change(index, { ...row, op: op as Operator })
                  }
                >
                  <SelectTrigger aria-label="Condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorsFor(field.type).map((op) => (
                      <SelectItem key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove filter"
                  className="sm:order-last"
                  onClick={() => onChange(rows.filter((_, at) => at !== index))}
                >
                  <X className="size-4" />
                </Button>
                <div className="col-span-3 sm:col-span-1">
                  {needsValue(row.op) ? (
                    <FieldInput
                      field={
                        field.type === "multi_select"
                          ? { ...field, type: "select" }
                          : field.type === "long_text"
                            ? { ...field, type: "text" }
                            : field
                      }
                      value={row.value}
                      onChange={(value) => change(index, { ...row, value })}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={add}
          >
            <Plus className="size-4" />
            Add a filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
