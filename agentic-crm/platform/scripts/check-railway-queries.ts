import { buildClientSchema, getIntrospectionQuery, parse, validate } from "graphql";
import { QUERIES } from "../src/railway";

// Checks the provisioner's queries against Railway's live schema, which answers introspection without a token.
const response = await fetch("https://backboard.railway.com/graphql/v2", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query: getIntrospectionQuery() }),
});
const { data } = (await response.json()) as { data: Parameters<typeof buildClientSchema>[0] };
const schema = buildClientSchema(data);
let failures = 0;
for (const [name, query] of Object.entries(QUERIES)) {
  const errors = validate(schema, parse(query));
  if (errors.length) failures++;
  console.log(errors.length ? `✗ ${name}: ${errors.map((error) => error.message).join("; ")}` : `✓ ${name}`);
}
process.exit(failures ? 1 : 0);
