import { bucketLabel, fillPeriods } from "./report";

describe("report periods", () => {
  test("months with no records are filled with zero between the first and the last", () => {
    const rows = [
      { key: "2026-01-01T00:00:00.000Z", value: 3 },
      { key: "2026-04-01T00:00:00.000Z", value: 5 },
    ];

    const filled = fillPeriods(rows, "month");

    expect(
      filled.map((row) => [bucketLabel(row.key, "month"), row.value]),
    ).toEqual([
      [bucketLabel("2026-01-01T00:00:00.000Z", "month"), 3],
      [bucketLabel("2026-02-01T00:00:00.000Z", "month"), 0],
      [bucketLabel("2026-03-01T00:00:00.000Z", "month"), 0],
      [bucketLabel("2026-04-01T00:00:00.000Z", "month"), 5],
    ]);
  });

  test("quarters and weeks are named so a reader can place them", () => {
    expect(bucketLabel("2026-10-01T00:00:00.000Z", "quarter")).toBe("Q4 2026");
    expect(bucketLabel("2026-10-12T00:00:00.000Z", "week")).toMatch(
      /^Week of /,
    );
    expect(bucketLabel(null, "month")).toBe("None");
  });
});
