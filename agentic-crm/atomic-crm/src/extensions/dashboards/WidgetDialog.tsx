import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FilterEditor } from "../objects/FilterEditor";
import { type FilterRow, filterOf, rowsOf } from "../objects/filters";
import {
  filterKey,
  isCustomObject,
  useAccess,
  useMetadata,
} from "../objects/model";
import type { Aggregate, DateBucket, FieldDefinition, Widget } from "../types";

const NONE = "__none__";

const TYPES: Record<Widget["type"], string> = {
  number: "A number",
  bar: "Bars",
  line: "A line over time",
  list: "A list",
};

const AGGREGATES: Record<Aggregate, string> = {
  count: "How many",
  sum: "Total of",
  avg: "Average of",
  min: "Smallest",
  max: "Largest",
};

const BUCKETS: Record<DateBucket, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

const WIDTHS: Record<Widget["width"], string> = {
  1: "Narrow",
  2: "Medium",
  3: "Full width",
};

const isDate = (field: FieldDefinition | undefined) =>
  field?.type === "date" || field?.type === "datetime";
const isNumeric = (field: FieldDefinition) =>
  ["number", "currency", "rating"].includes(field.type);
const canGroup = (field: FieldDefinition) =>
  [
    "select",
    "boolean",
    "text",
    "relation",
    "date",
    "datetime",
    "rating",
  ].includes(field.type);

const Choose = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([option, text]) => (
          <SelectItem key={option} value={option}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

type WidgetDialogProps = {
  widget?: Widget;
  onSave: (widget: Widget) => void;
  onClose: () => void;
};

/** Sets up a widget: what it counts or adds up, over which records, and how it is drawn. */
export const WidgetDialog = ({
  widget,
  onSave,
  onClose,
}: WidgetDialogProps) => {
  const { data } = useMetadata();
  const { data: access } = useAccess();
  const objects = (data?.objects ?? []).filter(
    (object) => access?.objects[object.name]?.read !== "none",
  );
  const [title, setTitle] = useState(widget?.title ?? "");
  const [objectName, setObjectName] = useState(widget?.object ?? "deals");
  const [type, setType] = useState<Widget["type"]>(widget?.type ?? "bar");
  const [fn, setFn] = useState<Aggregate>(widget?.fn ?? "count");
  const [field, setField] = useState(widget?.field ?? "");
  const [groupBy, setGroupBy] = useState(widget?.group_by ?? "");
  const [bucket, setBucket] = useState<DateBucket>(widget?.bucket ?? "month");
  const [width, setWidth] = useState<Widget["width"]>(widget?.width ?? 1);

  const object = objects.find((each) => each.name === objectName);
  const custom = isCustomObject(object);
  const hidden = new Set(access?.objects[objectName]?.hidden ?? []);
  const fields = (data?.fields ?? []).filter(
    (each) => each.object === objectName && !hidden.has(each.name),
  );
  const keyOf = (each: FieldDefinition) => filterKey(each, custom);
  const [rows, setRows] = useState<FilterRow[]>(() =>
    rowsOf(widget?.filter, fields, custom),
  );
  const grouped = fields.find((each) => keyOf(each) === groupBy);
  const groupChoices = fields.filter((each) =>
    type === "line" ? isDate(each) : canGroup(each),
  );
  const numeric = fields.filter(isNumeric);
  const needsGroup = type !== "number";
  const ready =
    Boolean(object) &&
    (!needsGroup || Boolean(grouped)) &&
    (fn === "count" || Boolean(field));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !object) return;
    const measured = numeric.find((each) => keyOf(each) === field);
    const defaultTitle = [
      fn === "count"
        ? object.label_plural
        : `${AGGREGATES[fn]} ${measured?.label.toLowerCase() ?? ""}`,
      needsGroup && grouped ? `by ${grouped.label.toLowerCase()}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    onSave({
      id: widget?.id ?? crypto.randomUUID().slice(0, 8),
      title: title.trim() || defaultTitle,
      type,
      object: object.name,
      filter: filterOf(rows, fields, custom),
      fn,
      ...(fn !== "count" ? { field } : {}),
      ...(needsGroup && grouped ? { group_by: groupBy } : {}),
      ...(needsGroup && isDate(grouped) ? { bucket } : {}),
      width,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>{widget ? "Change chart" : "Add a chart"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="widget-title">Title</Label>
            <Input
              id="widget-title"
              placeholder="Named from what it shows if left empty"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choose
              label="Records"
              value={objectName}
              options={objects.map((each) => [each.name, each.label_plural])}
              onChange={(next) => {
                setObjectName(next);
                setField("");
                setGroupBy("");
                setRows([]);
              }}
            />
            <Choose
              label="Show"
              value={type}
              options={Object.entries(TYPES)}
              onChange={(next) => {
                setType(next as Widget["type"]);
                setGroupBy("");
              }}
            />
            <Choose
              label="Measure"
              value={fn}
              options={Object.entries(AGGREGATES).filter(
                ([each]) => each === "count" || numeric.length,
              )}
              onChange={(next) => setFn(next as Aggregate)}
            />
            {fn !== "count" ? (
              <Choose
                label="Of"
                value={field || NONE}
                options={[
                  [NONE, "Choose a field"],
                  ...numeric.map((each): [string, string] => [
                    keyOf(each),
                    each.label,
                  ]),
                ]}
                onChange={(next) => setField(next === NONE ? "" : next)}
              />
            ) : null}
            {needsGroup ? (
              <Choose
                label={type === "line" ? "Over" : "By"}
                value={groupBy || NONE}
                options={[
                  [NONE, "Choose a field"],
                  ...groupChoices.map((each): [string, string] => [
                    keyOf(each),
                    each.label,
                  ]),
                ]}
                onChange={(next) => setGroupBy(next === NONE ? "" : next)}
              />
            ) : null}
            {needsGroup && isDate(grouped) ? (
              <Choose
                label="Per"
                value={bucket}
                options={Object.entries(BUCKETS)}
                onChange={(next) => setBucket(next as DateBucket)}
              />
            ) : null}
            <Choose
              label="Size"
              value={String(width)}
              options={Object.entries(WIDTHS)}
              onChange={(next) => setWidth(Number(next) as Widget["width"])}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Only records where</Label>
            <div>
              <FilterEditor fields={fields} rows={rows} onChange={setRows} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
