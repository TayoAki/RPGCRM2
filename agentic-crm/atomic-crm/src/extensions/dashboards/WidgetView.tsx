import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { Widget } from "../types";
import { BarList, Columns, Donut, Trend } from "./Charts";
import {
  fillPeriods,
  useGroupLabels,
  useReport,
  useValueFormat,
  useWidgetFields,
} from "./report";

const WIDTHS = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3" };

type WidgetViewProps = {
  widget: Widget;
  onEdit?: () => void;
  onRemove?: () => void;
};

/** One widget: a headline number, a bar list, columns, a line or a donut, over the records its owner may see. */
export const WidgetView = ({ widget, onEdit, onRemove }: WidgetViewProps) => {
  const { data = [], error, isPending, isPlaceholderData } = useReport(widget);
  const { groupField, measuredField } = useWidgetFields(widget);
  const label = useGroupLabels(data, groupField, widget.bucket);
  const format = useValueFormat(widget, measuredField);
  const additive = widget.fn === "count" || widget.fn === "sum";
  const rows =
    widget.bucket && additive ? fillPeriods(data, widget.bucket) : data;

  const body = () => {
    if (error) {
      return (
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Couldn't load this."}
        </p>
      );
    }
    if (isPending) return <div className="h-24" />;
    if (widget.type === "number" || !widget.group_by) {
      return (
        <p className="text-5xl font-semibold tabular-nums">
          {format(rows[0]?.value ?? 0)}
        </p>
      );
    }
    if (!rows.length) {
      return (
        <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
      );
    }
    if (widget.type === "line" && widget.bucket) {
      return <Trend rows={rows} label={label} format={format} />;
    }
    if (widget.bucket) {
      return <Columns rows={rows} label={label} format={format} />;
    }
    if (widget.type === "pie" && additive) {
      return <Donut rows={rows} label={label} format={format} />;
    }
    if (widget.type === "list") {
      return (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.key)} className="border-b last:border-0">
                <td className="py-1 text-muted-foreground">{label(row.key)}</td>
                <td className="py-1 text-right tabular-nums">
                  {format(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <BarList rows={rows} label={label} format={format} additive={additive} />
    );
  };

  return (
    <Card className={cn("gap-3", WIDTHS[widget.width])}>
      <CardContent
        className={cn(
          "@container flex flex-col gap-3 transition-opacity",
          isPlaceholderData && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium">{widget.title}</h2>
          {onEdit || onRemove ? (
            <div className="-mt-1 flex">
              {onEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Change ${widget.title}`}
                  onClick={onEdit}
                >
                  <Pencil className="size-4" />
                </Button>
              ) : null}
              {onRemove ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${widget.title}`}
                  onClick={onRemove}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {body()}
      </CardContent>
    </Card>
  );
};
