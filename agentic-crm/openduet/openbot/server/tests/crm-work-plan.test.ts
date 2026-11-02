import { expect, test } from "bun:test";
import {
  checkPlan,
  routineFor,
  routineInstruction,
  runsPerMonth,
} from "../src/crm/business/plan";

const job = (title: string, cron: string, id?: string) => ({
  ...(id ? { id } : {}),
  title,
  why: "Moves the pipeline goal.",
  cron,
  instruction: "Do the job.",
});

test("a plan gets unique slug ids and keeps the ones it was given", () => {
  const checked = checkPlan({
    items: [
      job("Monday lead list", "0 8 * * 1"),
      job("Monday lead list", "0 9 * * 1"),
      job("Pipeline review", "0 16 * * 5", "friday-review"),
    ],
  });

  expect(checked.ok && checked.plan.map((item) => item.id)).toEqual([
    "monday-lead-list",
    "monday-lead-list-2",
    "friday-review",
  ]);
});

test("a plan with a schedule routines can't run is refused, naming the job", () => {
  const unreadable = checkPlan({
    items: [job("Inbox triage", "every morning")],
  });
  const tooOften = checkPlan({ items: [job("Inbox triage", "* * * * *")] });
  const empty = checkPlan({ items: [] });

  expect(unreadable.ok ? null : unreadable.message).toContain('"Inbox triage"');
  expect(tooOften.ok).toBe(false);
  expect(empty.ok).toBe(false);
});

test("runs a month follow the schedule", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  expect(runsPerMonth("0 8 * * 1", "UTC", now)).toBe(4);
  expect(runsPerMonth("0 8 * * 1-5", "UTC", now)).toBe(22);
  expect(runsPerMonth("0 8 1 * *", "UTC", now)).toBe(1);
});

test("an item's routine is found again by its first line", () => {
  const checked = checkPlan({ items: [job("Pipeline review", "0 16 * * 5")] });
  const item = checked.ok ? checked.plan[0] : undefined;
  if (!item) throw new Error("plan refused");
  const instruction = routineInstruction(item);

  expect(instruction).toBe(
    "Work plan item pipeline-review: Pipeline review.\nDo the job.",
  );
  expect(
    routineFor(item, [
      { instruction: "Build this week's lead list." },
      { instruction },
    ]),
  ).toEqual({
    instruction,
  });
  expect(routineFor({ id: "pipeline" }, [{ instruction }])).toBeNull();
});
