import { useQuery } from "@tanstack/react-query";
import { useGetMany } from "ra-core";

import { useConfigurationContext } from "../../components/atomic-crm/root/ConfigurationContext";
import { crmApi } from "../api";
import { useFieldChoices } from "../objects/choices";
import {
  filterKey,
  isCustomObject,
  titleOf,
  useMetadata,
} from "../objects/model";
import type { DateBucket, FieldDefinition, ReportRow, Widget } from "../types";

export const dashboardsKey = ["crm", "dashboards"];

export const useReport = (widget: Widget) =>
  useQuery({
    queryKey: ["crm", "report", widget],
    queryFn: () =>
      crmApi<ReportRow[]>("/reports", {
        method: "POST",
        body: {
          object: widget.object,
          filter: widget.filter ?? {},
          fn: widget.fn,
          ...(widget.field ? { field: widget.field } : {}),
          ...(widget.group_by ? { group_by: widget.group_by } : {}),
          ...(widget.bucket ? { bucket: widget.bucket } : {}),
        },
      }),
    placeholderData: (previous) => previous,
  });

/** A widget's object and the field definitions behind its filter keys. */
export function useWidgetFields(widget: Widget) {
  const { data } = useMetadata();
  const object = data?.objects.find((each) => each.name === widget.object);
  const custom = isCustomObject(object);
  const fields = (data?.fields ?? []).filter(
    (field) => field.object === widget.object,
  );
  const byKey = (key: string | undefined) =>
    key ? fields.find((field) => filterKey(field, custom) === key) : undefined;
  return {
    object,
    fields,
    custom,
    groupField: byKey(widget.group_by),
    measuredField: byKey(widget.field),
  };
}

const BUCKET_FORMATS: Record<DateBucket, Intl.DateTimeFormatOptions> = {
  day: { month: "short", day: "numeric", timeZone: "UTC" },
  week: { month: "short", day: "numeric", timeZone: "UTC" },
  month: { month: "short", year: "numeric", timeZone: "UTC" },
  quarter: { year: "numeric", timeZone: "UTC" },
  year: { year: "numeric", timeZone: "UTC" },
};

export function bucketLabel(value: unknown, bucket: DateBucket) {
  if (typeof value !== "string") return "None";
  const date = new Date(value);
  const text = new Intl.DateTimeFormat(
    undefined,
    BUCKET_FORMATS[bucket],
  ).format(date);
  if (bucket === "quarter")
    return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${text}`;
  if (bucket === "week") return `Week of ${text}`;
  return text;
}

/** Names for a report's groups: choices' labels, linked records' titles, or dates by period. */
export function useGroupLabels(
  rows: ReportRow[],
  field: FieldDefinition | undefined,
  bucket: DateBucket | undefined,
) {
  const choicesOf = useFieldChoices();
  const target = field?.type === "relation" ? field.options.target : undefined;
  const ids = target
    ? rows.flatMap((row) => (row.key == null ? [] : [row.key as number]))
    : [];
  const { data: linked = [] } = useGetMany(
    target ?? "contacts",
    { ids },
    { enabled: Boolean(target && ids.length) },
  );
  const choices = field ? choicesOf(field) : undefined;
  return (key: unknown): string => {
    if (bucket) return bucketLabel(key, bucket);
    if (key === null || key === undefined || key === "") return "None";
    if (target) {
      const record = linked.find((each) => each.id === key);
      return record ? titleOf(target, record) : `#${key}`;
    }
    return (
      choices?.find((choice) => choice.value === String(key))?.label ??
      String(key)
    );
  };
}

/** How a widget's numbers read: money for sums of amounts, whole numbers for counts. */
export function useValueFormat(
  widget: Widget,
  field: FieldDefinition | undefined,
) {
  const { currency } = useConfigurationContext();
  const money = widget.fn !== "count" && field?.type === "currency";
  const format = new Intl.NumberFormat(undefined, {
    ...(money
      ? {
          style: "currency",
          currency: field?.options.currency ?? currency,
          maximumFractionDigits: 0,
        }
      : { maximumFractionDigits: widget.fn === "avg" ? 1 : 0 }),
  });
  return (value: number) => format.format(value);
}

const MAX_PERIODS = 400;

const nextPeriod = (date: Date, bucket: DateBucket) => {
  const next = new Date(date);
  if (bucket === "day") next.setUTCDate(next.getUTCDate() + 1);
  if (bucket === "week") next.setUTCDate(next.getUTCDate() + 7);
  if (bucket === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  if (bucket === "quarter") next.setUTCMonth(next.getUTCMonth() + 3);
  if (bucket === "year") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
};

/** Periods with no records come back missing; for counts and sums they are zero, not skipped. */
export function fillPeriods(
  rows: ReportRow[],
  bucket: DateBucket,
): ReportRow[] {
  const dated = rows.filter((row) => typeof row.key === "string");
  if (dated.length < 2) return dated;
  const byLabel = new Map(
    dated.map((row) => [bucketLabel(row.key, bucket), row]),
  );
  const last = bucketLabel(dated[dated.length - 1].key, bucket);
  const filled: ReportRow[] = [];
  let date = new Date(String(dated[0].key));
  while (filled.length < MAX_PERIODS) {
    const label = bucketLabel(date.toISOString(), bucket);
    filled.push(byLabel.get(label) ?? { key: date.toISOString(), value: 0 });
    if (label === last) break;
    date = nextPeriod(date, bucket);
  }
  return filled;
}
