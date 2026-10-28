import type { FieldDefinition } from "../types";
import { dayKey, monthFilter, weeksOf } from "./calendar";

const due = (type: "date" | "datetime"): FieldDefinition => ({
  id: 1,
  object: "projects",
  name: "due",
  label: "Due",
  type,
  options: {},
  required: false,
  position: 0,
  standard: false,
});

describe("calendar", () => {
  test("a month is shown as whole weeks starting on Monday, covering every day", () => {
    const weeks = weeksOf(new Date(2026, 9, 1));
    const days = weeks.flat().map(dayKey);

    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0].getDay()).toBe(1);
    expect(days[0]).toBe("2026-09-28");
    expect(days).toContain("2026-10-01");
    expect(days).toContain("2026-10-31");
    expect(days.at(-1)).toBe("2026-11-01");
  });

  test("a date field is bounded by days, a date-time field by instants", () => {
    const month = new Date(2026, 9, 1);

    expect(monthFilter(month, due("date"), true)).toEqual({
      "due@gte": "2026-10-01",
      "due@lt": "2026-11-01",
    });
    expect(monthFilter(month, due("datetime"), false)).toEqual({
      "custom_fields.due@gte": new Date(2026, 9, 1).toISOString(),
      "custom_fields.due@lt": new Date(2026, 10, 1).toISOString(),
    });
  });
});
