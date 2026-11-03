import { expect, test } from "bun:test";
import { parametersFor } from "@openbot/toolkit/granted-tool";
import { zodSchema } from "ai";
import { listTools } from "../src/crm/agent-tools";

test("a model is shown the fields it can put on a new record", async () => {
  const tool = (await listTools()).find(
    (each) => each.name === "create_record",
  );
  const parameters = parametersFor(tool?.inputSchema ?? {});
  const shown = zodSchema(parameters as never).jsonSchema as {
    properties: {
      values: {
        properties: Record<string, { items?: { properties?: object } }>;
      };
    };
  };

  expect(Object.keys(shown.properties.values.properties)).toEqual(
    expect.arrayContaining(["name", "website", "phone_number", "first_name"]),
  );
  expect(
    shown.properties.values.properties.email_jsonb?.items?.properties,
  ).toHaveProperty("email");
  expect(
    parameters.parse({
      resource: "companies",
      values: { name: "Acme", extra: "kept" },
    }),
  ).toEqual({ resource: "companies", values: { name: "Acme", extra: "kept" } });
});
