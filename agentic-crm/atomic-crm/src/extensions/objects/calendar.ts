import type { FieldDefinition } from "../types";
import { filterKey } from "./model";

const pad = (number: number) => String(number).padStart(2, "0");

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The day a value falls on, in the viewer's time zone for date-times. */
export function dayOf(value: unknown, field: FieldDefinition): string | null {
  if (typeof value !== "string" || !value) return null;
  return field.type === "date" ? value.slice(0, 10) : dayKey(new Date(value));
}

export const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

/** The filter for a month's records on a date field. */
export function monthFilter(
  month: Date,
  field: FieldDefinition,
  custom: boolean,
): Record<string, unknown> {
  const key = filterKey(field, custom);
  const next = addMonths(month, 1);
  const bound = (date: Date) =>
    field.type === "date" ? dayKey(date) : date.toISOString();
  return { [`${key}@gte`]: bound(month), [`${key}@lt`]: bound(next) };
}

/** The weeks shown for a month, Monday first, as whole weeks. */
export function weeksOf(month: Date): Date[][] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks: Date[][] = [];
  const day = new Date(start);
  while (weeks.length < 6) {
    const week: Date[] = [];
    for (let index = 0; index < 7; index += 1) {
      week.push(new Date(day));
      day.setDate(day.getDate() + 1);
    }
    weeks.push(week);
    if (day.getMonth() !== first.getMonth() && day > first) break;
  }
  return weeks;
}
