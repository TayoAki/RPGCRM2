import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAutomationInfo } from "../queries";
import type { Trigger } from "../types";
import { ConditionsEditor } from "./ConditionsEditor";
import { OBJECTS } from "./describe";

const KINDS: { id: Trigger["type"]; label: string }[] = [
  { id: "record", label: "When a record is added, changed or deleted" },
  { id: "date", label: "Before or after a date on a record" },
  { id: "schedule", label: "On a schedule" },
  { id: "webhook", label: "When another app sends to its address" },
  { id: "manual", label: "When someone runs it on a record" },
];

const SCHEDULES = [
  ["0 9 * * 1-5", "Every weekday at 9:00"],
  ["0 8 * * *", "Every day at 8:00"],
  ["0 9 * * 1", "Every Monday at 9:00"],
  ["0 * * * *", "Every hour"],
] as const;

const UNITS = [
  { id: "1", label: "minutes" },
  { id: "60", label: "hours" },
  { id: "1440", label: "days" },
];

const fresh = (type: Trigger["type"], object: string): Trigger => {
  switch (type) {
    case "record":
      return { type, object, on: ["created"] };
    case "date":
      return {
        type,
        object: "meetings",
        field: "start_at",
        offset_minutes: -1440,
      };
    case "schedule":
      return { type, cron: "0 9 * * 1-5" };
    case "webhook":
      return { type };
    case "manual":
      return { type, object };
  }
};

const ObjectSelect = ({
  value,
  onChange,
  optional,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  optional?: boolean;
}) => (
  <Select
    value={value ?? "none"}
    onValueChange={(next) => onChange(next === "none" ? undefined : next)}
  >
    <SelectTrigger className="w-56" aria-label="Kind of record">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {optional ? (
        <SelectItem value="none">Once (no records)</SelectItem>
      ) : null}
      {OBJECTS.map((object) => (
        <SelectItem key={object.id} value={object.id}>
          {optional ? `Once for each of: ${object.many}` : object.many}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

/** What starts the automation. */
export const TriggerEditor = ({
  value,
  onChange,
}: {
  value: Trigger;
  onChange: (value: Trigger) => void;
}) => {
  const { data: info } = useAutomationInfo();
  const object = "object" in value ? value.object : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Select
        value={value.type}
        onValueChange={(type) =>
          onChange(fresh(type as Trigger["type"], object ?? "contacts"))
        }
      >
        <SelectTrigger aria-label="Starts">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KINDS.map((kind) => (
            <SelectItem key={kind.id} value={kind.id}>
              {kind.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.type === "record" ? (
        <div className="flex flex-wrap items-center gap-4">
          <ObjectSelect
            value={value.object}
            onChange={(next) => next && onChange({ ...value, object: next })}
          />
          {(["created", "updated", "deleted"] as const).map((action) => (
            <div key={action} className="flex items-center gap-2">
              <Checkbox
                id={`on-${action}`}
                checked={value.on.includes(action)}
                onCheckedChange={(checked) =>
                  onChange({
                    ...value,
                    on: checked
                      ? [...value.on, action]
                      : value.on.filter((each) => each !== action),
                  })
                }
              />
              <Label htmlFor={`on-${action}`}>
                {
                  { created: "Added", updated: "Changed", deleted: "Deleted" }[
                    action
                  ]
                }
              </Label>
            </div>
          ))}
        </div>
      ) : null}

      {value.type === "date" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input
            type="number"
            min={0}
            aria-label="How long"
            className="w-20"
            value={
              Math.abs(value.offset_minutes) / unitOf(value.offset_minutes)
            }
            onChange={(event) =>
              onChange({
                ...value,
                offset_minutes:
                  Math.sign(value.offset_minutes || -1) *
                  Number(event.target.value) *
                  unitOf(value.offset_minutes),
              })
            }
          />
          <Select
            value={String(unitOf(value.offset_minutes))}
            onValueChange={(unit) =>
              onChange({
                ...value,
                offset_minutes:
                  (value.offset_minutes / unitOf(value.offset_minutes)) *
                  Number(unit),
              })
            }
          >
            <SelectTrigger className="w-28" aria-label="Unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={value.offset_minutes > 0 ? "after" : "before"}
            onValueChange={(side) =>
              onChange({
                ...value,
                offset_minutes:
                  Math.abs(value.offset_minutes) * (side === "after" ? 1 : -1),
              })
            }
          >
            <SelectTrigger className="w-28" aria-label="Before or after">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before">before</SelectItem>
              <SelectItem value="after">after</SelectItem>
            </SelectContent>
          </Select>
          <span>a</span>
          <ObjectSelect
            value={value.object}
            onChange={(next) =>
              next &&
              onChange({
                ...value,
                object: next,
                field: info?.date_fields[next]?.[0] ?? value.field,
              })
            }
          />
          <span>'s</span>
          <Select
            value={value.field}
            onValueChange={(field) => onChange({ ...value, field })}
          >
            <SelectTrigger className="w-44" aria-label="Date field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(info?.date_fields[value.object] ?? [value.field]).map(
                (field) => (
                  <SelectItem key={field} value={field}>
                    {field.replaceAll("_", " ")}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {value.type === "schedule" ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              value={
                SCHEDULES.some(([cron]) => cron === value.cron)
                  ? value.cron
                  : "custom"
              }
              onValueChange={(cron) =>
                cron !== "custom" && onChange({ ...value, cron })
              }
            >
              <SelectTrigger className="w-60" aria-label="When">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULES.map(([cron, label]) => (
                  <SelectItem key={cron} value={cron}>
                    {label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label="Schedule"
              className="w-40 font-mono"
              value={value.cron}
              onChange={(event) =>
                onChange({ ...value, cron: event.target.value })
              }
            />
            <ObjectSelect
              optional
              value={value.object}
              onChange={(next) => {
                const { object: _, ...rest } = value;
                onChange(next ? { ...rest, object: next } : rest);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Minute, hour, day of the month, month, day of the week, in the CRM's
            time zone.
          </p>
        </div>
      ) : null}

      {value.type === "manual" ? (
        <ObjectSelect
          value={value.object}
          onChange={(next) => next && onChange({ ...value, object: next })}
        />
      ) : null}

      {value.type === "record" ||
      value.type === "date" ||
      value.type === "schedule" ? (
        <ConditionsEditor
          object={object}
          value={value.when}
          onChange={(when) => onChange({ ...value, when } as Trigger)}
          emptyText={
            value.type === "schedule" && !object
              ? "Runs once each time."
              : "Every time. Add conditions to narrow it."
          }
        />
      ) : null}
    </div>
  );
};

function unitOf(minutes: number) {
  const abs = Math.abs(minutes);
  if (abs !== 0 && abs % 1440 === 0) return 1440;
  if (abs !== 0 && abs % 60 === 0) return 60;
  return abs === 0 ? 1440 : 1;
}
