import { expect, test } from "bun:test";
import { groupHolds, holds } from "../src/crm/workflows/conditions";
import { workflowInput } from "../src/crm/workflows/definition";
import { advance, stepAt } from "../src/crm/workflows/engine";
import { RECIPES } from "../src/crm/workflows/recipes";
import { renderText, renderValue } from "../src/crm/workflows/render";

const options = { timezone: "America/New_York", currency: "USD" };
const scope = {
  contact: {
    id: 7,
    first_name: "Ada",
    name: "Ada Lovelace",
    email: "ada@x.test",
  },
  company: { name: "" },
  meeting: { start_at: "2026-11-02T15:00:00.000Z", outcome: "Send proposal" },
  deal: { amount: 12500, contact_ids: [7, 8] },
  record: { stage: "won", tags: [1, 2] },
  previous: { stage: "proposal-sent" },
};

test("templates fill fields, format dates in the CRM's time zone, and fall back", () => {
  expect(
    renderText(
      "Hi {{contact.first_name}}, see you {{meeting.start_at | datetime}} ({{deal.amount | money}}).",
      scope,
      options,
    ),
  ).toBe("Hi Ada, see you Monday, November 2, 2026 at 10:00 AM EST ($12,500).");
  expect(
    renderText("{{meeting.start_at | add_hours:-1 | time}}", scope, options),
  ).toBe("9:00 AM EST");
  expect(
    renderText('{{contact.nickname | default:"there"}}', scope, options),
  ).toBe("there");
  expect(
    renderText("{{company.name | default:contact.name}}", scope, options),
  ).toBe("Ada Lovelace");
  expect(renderText("{{nothing.here}}!", scope, options)).toBe("!");
});

test("a value that is one field keeps its type", () => {
  expect(
    renderValue(
      { ids: ["{{contact.id}}"], n: "{{deal.amount}}" },
      scope,
      options,
    ),
  ).toEqual({
    ids: [7],
    n: 12500,
  });
  expect(renderValue("Deal {{deal.amount}}", scope, options)).toBe(
    "Deal 12500",
  );
});

test("conditions compare text without case, lists, emptiness, dates and changes", () => {
  const check = (
    field: string,
    op: Parameters<typeof holds>[0]["op"],
    value?: unknown,
  ) => holds({ field, op, value }, scope, options);

  expect(check("record.stage", "is", "Won")).toBe(true);
  expect(check("record.stage", "changed")).toBe(true);
  expect(check("record.tags", "contains", 2)).toBe(true);
  expect(check("meeting.outcome", "in", "Interested,Send proposal")).toBe(true);
  expect(check("company.name", "is_empty")).toBe(true);
  expect(check("meeting.start_at", "after", "2026-11-01T00:00:00Z")).toBe(true);
  expect(check("contact.last_seen", "after", "2026-11-01T00:00:00Z")).toBe(
    false,
  );
  expect(
    groupHolds(
      {
        match: "any",
        conditions: [
          { field: "record.stage", op: "is", value: "lost" },
          { field: "deal.amount", op: "gt", value: 10000 },
        ],
      },
      scope,
      options,
    ),
  ).toBe(true);
});

test("a run moves through branches and back out of them", () => {
  const steps = workflowInput.parse({
    name: "x",
    trigger: { type: "webhook" },
    steps: [
      { id: "a", type: "stop" },
      {
        id: "b",
        type: "if",
        when: { conditions: [] },
        if_true: [
          { id: "c", type: "stop" },
          { id: "d", type: "stop" },
        ],
        if_false: [],
      },
      { id: "e", type: "stop" },
    ],
  }).steps;

  expect(stepAt(steps, [1, "if_true", 1])?.id).toBe("d");
  expect(advance(steps, [1, "if_true", 1])).toEqual([2]);
  expect(stepAt(steps, advance(steps, [2]))).toBeUndefined();
});

test("every ready-made automation is a valid workflow", () => {
  for (const { key: _, needs: __, ...recipe } of RECIPES) {
    expect(() => workflowInput.parse(recipe)).not.toThrow();
  }
});
