import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import type { ReportRow } from "../types";

// The reference categorical order, stepped per theme; validated light and dark with the
// wrap-around pair a donut adds. One series always takes the first slot.
const PALETTE = [
  "[--slice-0:#2a78d6] dark:[--slice-0:#3987e5]",
  "[--slice-1:#eb6834] dark:[--slice-1:#d95926]",
  "[--slice-2:#1baf7a] dark:[--slice-2:#199e70]",
  "[--slice-3:#eda100] dark:[--slice-3:#c98500]",
  "[--slice-4:#e87ba4] dark:[--slice-4:#d55181]",
  "[--slice-5:#898781]",
].join(" ");
const SERIES = "var(--slice-0)";
const OTHER = "var(--slice-5)";

const SHOWN_BARS = 12;
const SHOWN_SLICES = 5;
const BAR_ROW = 28;

const CONFIG: ChartConfig = { value: { label: "Value" } };

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });
const percent = new Intl.NumberFormat(undefined, { style: "percent" });

type ChartProps = {
  rows: ReportRow[];
  label: (key: unknown) => string;
  format: (value: number) => string;
  // Counts and sums add up, so the tail can fold into "Other"; averages can't.
  additive?: boolean;
};

type Point = { name: string; value: number };

const pointsOf = ({ rows, label }: ChartProps): Point[] =>
  rows.map((row) => ({ name: label(row.key), value: row.value }));

const total = (points: Point[]) =>
  points.reduce((sum, point) => sum + point.value, 0);

const fold = (points: Point[], shown: number, additive?: boolean) => {
  const rest = points.slice(shown);
  if (!rest.length || !additive) {
    return { items: points.slice(0, shown), hidden: rest.length };
  }
  return {
    items: [
      ...points.slice(0, shown),
      { name: `Other (${rest.length})`, value: total(rest) },
    ],
    hidden: 0,
  };
};

const truncate = (text: string) =>
  text.length > 18 ? `${text.slice(0, 17)}…` : text;

const tooltip = (format: ChartProps["format"], cursor = true) => (
  <ChartTooltip
    cursor={cursor}
    content={
      <ChartTooltipContent
        hideLabel
        hideIndicator
        formatter={(value, _name, item) => (
          <div className="flex flex-col">
            <span className="font-semibold tabular-nums">
              {format(Number(value))}
            </span>
            <span className="text-muted-foreground">{item.payload?.name}</span>
          </div>
        )}
      />
    }
  />
);

const axis = {
  tickLine: false,
  axisLine: false,
} as const;

/** Groups compared by size: one bar each, longest first, with its name and value. */
export const BarList = (props: ChartProps) => {
  const { items, hidden } = fold(pointsOf(props), SHOWN_BARS, props.additive);
  return (
    <div className={`flex flex-col gap-1 ${PALETTE}`}>
      <ChartContainer
        config={CONFIG}
        className="aspect-auto w-full"
        style={{ height: items.length * BAR_ROW }}
      >
        <BarChart
          data={items}
          layout="vertical"
          margin={{ top: 0, bottom: 0, left: 0, right: 64 }}
          accessibilityLayer
        >
          <YAxis
            {...axis}
            dataKey="name"
            type="category"
            width={128}
            tickFormatter={truncate}
          />
          <XAxis type="number" hide />
          {tooltip(props.format)}
          <Bar
            dataKey="value"
            fill={SERIES}
            isAnimationActive={false}
            radius={[0, 4, 4, 0]}
            barSize={16}
            minPointSize={2}
          >
            <LabelList
              dataKey="value"
              position="right"
              className="fill-foreground tabular-nums"
              formatter={(value) => props.format(Number(value))}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      {hidden ? (
        <p className="text-xs text-muted-foreground">{hidden} more not shown</p>
      ) : null}
    </div>
  );
};

/** A value over time: one column per period. */
export const Columns = (props: ChartProps) => (
  <ChartContainer
    config={CONFIG}
    className={`aspect-auto h-48 w-full ${PALETTE}`}
  >
    <BarChart data={pointsOf(props)} margin={{ top: 8 }} accessibilityLayer>
      <CartesianGrid vertical={false} />
      <XAxis {...axis} dataKey="name" minTickGap={24} />
      <YAxis
        {...axis}
        width={40}
        tickFormatter={(value) => compact.format(value)}
      />
      {tooltip(props.format)}
      <Bar
        dataKey="value"
        fill={SERIES}
        radius={[4, 4, 0, 0]}
        maxBarSize={48}
        isAnimationActive={false}
      />
    </BarChart>
  </ChartContainer>
);

/** A value over time as a line, with a crosshair on the nearest period. */
export const Trend = (props: ChartProps) => (
  <ChartContainer
    config={CONFIG}
    className={`aspect-auto h-48 w-full ${PALETTE}`}
  >
    <LineChart
      data={pointsOf(props)}
      margin={{ top: 8, right: 12 }}
      accessibilityLayer
    >
      <CartesianGrid vertical={false} />
      <XAxis {...axis} dataKey="name" minTickGap={24} />
      <YAxis
        {...axis}
        width={40}
        tickFormatter={(value) => compact.format(value)}
      />
      {tooltip(props.format)}
      <Line
        dataKey="value"
        type="linear"
        isAnimationActive={false}
        stroke={SERIES}
        strokeWidth={2}
        // A line needs two periods; a lone first period is shown as a point.
        dot={props.rows.length === 1 ? { r: 4, fill: SERIES } : false}
        activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
      />
    </LineChart>
  </ChartContainer>
);

/** Shares of a whole: the five largest groups, the rest folded into "Other", each named with its value. */
export const Donut = (props: ChartProps) => {
  const positive = pointsOf(props).filter((point) => point.value > 0);
  const { items } = fold(positive, SHOWN_SLICES, true);
  const whole = total(items);
  const slices = items.map((item, index) => ({
    ...item,
    fill: index < SHOWN_SLICES ? `var(--slice-${index})` : OTHER,
  }));
  return (
    <div className={`flex flex-col items-center gap-4 @md:flex-row ${PALETTE}`}>
      <ChartContainer config={CONFIG} className="aspect-square h-40 shrink-0">
        <PieChart accessibilityLayer>
          {tooltip(props.format, false)}
          <Pie
            data={slices}
            isAnimationActive={false}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            stroke="var(--card)"
            strokeWidth={2}
          />
        </PieChart>
      </ChartContainer>
      <ul className="flex w-full min-w-0 flex-col gap-1 text-sm">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ background: slice.fill }}
            />
            <span
              className="min-w-0 flex-1 truncate text-muted-foreground"
              title={slice.name}
            >
              {slice.name}
            </span>
            <span className="shrink-0 tabular-nums">
              {props.format(slice.value)}
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
              {percent.format(whole ? slice.value / whole : 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
