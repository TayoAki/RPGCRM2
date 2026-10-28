import { type PointerEvent, useState } from "react";
import { cn } from "@/lib/utils";

import type { ReportRow } from "../types";

// One series, so one hue (validated light and dark); text keeps the theme's ink.
const BAR = "bg-[#2a78d6] dark:bg-[#3987e5]";
const STROKE = "stroke-[#2a78d6] dark:stroke-[#3987e5]";

const SHOWN_BARS = 12;

type ChartProps = {
  rows: ReportRow[];
  label: (key: unknown) => string;
  format: (value: number) => string;
  // Counts and sums add up, so the tail can fold into "Other"; averages can't.
  additive?: boolean;
};

/** Groups compared by size: one bar each, longest first, with its name and value. */
export const BarList = ({ rows, label, format, additive }: ChartProps) => {
  const shown = rows.slice(0, SHOWN_BARS);
  const rest = rows.slice(SHOWN_BARS);
  const items = shown.map((row) => ({
    name: label(row.key),
    value: row.value,
  }));
  if (rest.length && additive) {
    items.push({
      name: `Other (${rest.length})`,
      value: rest.reduce((total, row) => total + row.value, 0),
    });
  }
  const max = Math.max(...items.map((item) => item.value), 0);
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li
          key={item.name}
          className="group grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-2 text-sm"
        >
          <span className="truncate text-muted-foreground" title={item.name}>
            {item.name}
          </span>
          <span className="h-4">
            <span
              className={cn(
                "block h-full min-w-0.5 rounded-r-[4px] transition-opacity group-hover:opacity-80",
                BAR,
              )}
              style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
            />
          </span>
          <span className="tabular-nums">{format(item.value)}</span>
        </li>
      ))}
      {rest.length && !additive ? (
        <li className="text-xs text-muted-foreground">
          {rest.length} more not shown
        </li>
      ) : null}
    </ul>
  );
};

const WIDTH = 600;
const HEIGHT = 200;
const PAD = 8;

const nearestIndex = (event: PointerEvent<HTMLDivElement>, count: number) => {
  const box = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientX - box.left) / box.width;
  return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
};

const Readout = ({
  name,
  value,
  left,
}: {
  name: string;
  value: string;
  left: number;
}) => (
  <div
    role="status"
    className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs shadow-sm"
    style={{ left: `${Math.min(90, Math.max(10, left))}%` }}
  >
    <div className="font-semibold tabular-nums">{value}</div>
    <div className="text-muted-foreground">{name}</div>
  </div>
);

const Axis = ({ rows, label }: Pick<ChartProps, "rows" | "label">) => {
  const marks = [
    ...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]),
  ];
  return (
    <div className="flex justify-between text-xs text-muted-foreground">
      {marks.map((index) => (
        <span key={index}>{label(rows[index]?.key)}</span>
      ))}
    </div>
  );
};

/** A value over time: one column per period, the hovered one named with its value. */
export const Columns = ({ rows, label, format }: ChartProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...rows.map((row) => row.value), 0);
  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative flex h-40 items-end gap-0.5 border-b pt-10"
        onPointerLeave={() => setHovered(null)}
      >
        {rows.map((row, index) => (
          <div
            key={String(row.key)}
            tabIndex={0}
            aria-label={`${label(row.key)}: ${format(row.value)}`}
            className="flex h-full flex-1 items-end"
            onPointerEnter={() => setHovered(index)}
            onFocus={() => setHovered(index)}
            onBlur={() => setHovered(null)}
          >
            <div
              className={cn(
                "w-full rounded-t-[4px]",
                BAR,
                hovered !== null && hovered !== index && "opacity-60",
              )}
              style={{ height: `${max > 0 ? (row.value / max) * 100 : 0}%` }}
            />
          </div>
        ))}
        {hovered !== null && rows[hovered] ? (
          <Readout
            name={label(rows[hovered].key)}
            value={format(rows[hovered].value)}
            left={((hovered + 0.5) / rows.length) * 100}
          />
        ) : null}
      </div>
      <Axis rows={rows} label={label} />
    </div>
  );
};

/** A value over time as a line, with a crosshair that finds the nearest period. */
export const LineChart = ({ rows, label, format }: ChartProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...rows.map((row) => row.value), 0) || 1;
  const x = (index: number) =>
    rows.length > 1
      ? PAD + (index / (rows.length - 1)) * (WIDTH - 2 * PAD)
      : WIDTH / 2;
  const y = (value: number) =>
    HEIGHT - PAD - (value / max) * (HEIGHT - 2 * PAD);
  const path = rows
    .map((row, index) => `${index ? "L" : "M"}${x(index)},${y(row.value)}`)
    .join(" ");
  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative pt-10"
        onPointerMove={(event) => setHovered(nearestIndex(event, rows.length))}
        onPointerLeave={() => setHovered(null)}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-40 w-full overflow-visible"
          role="img"
          aria-label={rows
            .map((row) => `${label(row.key)}: ${format(row.value)}`)
            .join(", ")}
        >
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT - PAD}
            y2={HEIGHT - PAD}
            className="stroke-border"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={path}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            className={STROKE}
            vectorEffect="non-scaling-stroke"
          />
          {hovered !== null ? (
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={0}
              y2={HEIGHT}
              className="stroke-muted-foreground/50"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {hovered !== null && rows[hovered] ? (
          <>
            <span
              className={cn(
                "pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
                BAR,
              )}
              style={{
                left: `${(x(hovered) / WIDTH) * 100}%`,
                top: `calc(2.5rem + ${(y(rows[hovered].value) / HEIGHT) * 10}rem)`,
              }}
            />
            <Readout
              name={label(rows[hovered].key)}
              value={format(rows[hovered].value)}
              left={(x(hovered) / WIDTH) * 100}
            />
          </>
        ) : null}
      </div>
      <Axis rows={rows} label={label} />
    </div>
  );
};
