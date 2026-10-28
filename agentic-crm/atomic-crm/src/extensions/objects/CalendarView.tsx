import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FieldDefinition } from "../types";
import { addMonths, dayKey, dayOf, weeksOf } from "./calendar";
import { recordPath, titleOf, valueOf } from "./model";

const SHOWN_PER_DAY = 3;

type CalendarViewProps = {
  object: string;
  custom: boolean;
  dateField: FieldDefinition;
  month: Date;
  records: Record<string, unknown>[];
  onMonth: (month: Date) => void;
};

/** A month of records placed on the day of one of their dates. */
export const CalendarView = ({
  object,
  custom,
  dateField,
  month,
  records,
  onMonth,
}: CalendarViewProps) => {
  const byDay = new Map<string, Record<string, unknown>[]>();
  for (const record of records) {
    const day = dayOf(valueOf(record, dateField, custom), dateField);
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), record]);
  }
  const today = dayKey(new Date());
  const weekdays = weeksOf(month)[0].map((day) =>
    new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day),
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => onMonth(addMonths(month, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() => onMonth(addMonths(month, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="font-medium">
          {new Intl.DateTimeFormat(undefined, {
            month: "long",
            year: "numeric",
          }).format(month)}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[42rem] grid-cols-7 rounded-md border text-sm">
          {weekdays.map((weekday) => (
            <div
              key={weekday}
              className="border-b px-2 py-1 text-xs text-muted-foreground"
            >
              {weekday}
            </div>
          ))}
          {weeksOf(month)
            .flat()
            .map((day) => {
              const key = dayKey(day);
              const items = byDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-24 border-b border-r p-1",
                    day.getMonth() !== month.getMonth() &&
                      "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 text-xs",
                      key === today && "font-semibold text-primary",
                    )}
                  >
                    {day.getDate()}
                  </div>
                  {items.slice(0, SHOWN_PER_DAY).map((record) => (
                    <Link
                      key={String(record.id)}
                      to={recordPath(object, record.id)}
                      className="mb-1 block truncate rounded bg-primary/10 px-1 text-xs hover:underline"
                    >
                      {titleOf(object, record)}
                    </Link>
                  ))}
                  {items.length > SHOWN_PER_DAY ? (
                    <div className="text-xs text-muted-foreground">
                      {items.length - SHOWN_PER_DAY} more
                    </div>
                  ) : null}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
