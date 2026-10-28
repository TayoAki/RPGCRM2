import type { FieldDefinition } from "../types";
import { filterOf, rowsOf } from "./filters";

const field = (
  name: string,
  type: FieldDefinition["type"],
  standard = false,
): FieldDefinition => ({
  id: 1,
  object: "contacts",
  name,
  label: name,
  type,
  options: {},
  required: false,
  position: 0,
  standard,
});

const fields = [
  field("title", "text", true),
  field("tier", "select"),
  field("tags", "multi_select"),
  field("seats", "number"),
];

describe("filters", () => {
  test("a contact's custom fields are filtered under custom_fields, standard ones by column", () => {
    const filter = filterOf(
      [
        { field: "title", op: "contains", value: "lead" },
        { field: "tier", op: "is", value: "gold" },
        { field: "tags", op: "has", value: "vip" },
        { field: "seats", op: "at_least", value: 10 },
      ],
      fields,
      false,
    );

    expect(filter).toEqual({
      "title@ilike": "lead",
      "custom_fields.tier": "gold",
      "custom_fields.tags@cs": '{"vip"}',
      "custom_fields.seats@gte": 10,
    });
  });

  test("rows without a value are left out, and empty checks need none", () => {
    const filter = filterOf(
      [
        { field: "tier", op: "is", value: null },
        { field: "seats", op: "empty", value: null },
      ],
      fields,
      false,
    );

    expect(filter).toEqual({ "custom_fields.seats@is": null });
  });

  test("a saved filter comes back as the rows that made it", () => {
    const rows = [
      { field: "title", op: "is_not" as const, value: "CEO" },
      { field: "tags", op: "has" as const, value: "vip" },
      { field: "seats", op: "not_empty" as const, value: null },
    ];

    expect(rowsOf(filterOf(rows, fields, false), fields, false)).toEqual(rows);
  });

  test("filter keys the screen doesn't know are dropped rather than shown wrong", () => {
    expect(
      rowsOf(
        { "@or": { "title@ilike": "a" }, "unknown@gte": 1 },
        fields,
        false,
      ),
    ).toEqual([]);
  });
});
