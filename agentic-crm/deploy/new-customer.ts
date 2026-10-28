#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

/*
 * Writes one customer's deployment settings: customers/<customer>/.env, with fresh secrets, and the
 * branded tenant package beside it. Then fill in the keys it lists and run ./up.sh <customer>.
 *
 *   bun agentic-crm/deploy/new-customer.ts --customer acme --name "Acme CRM" \
 *     --domain crm.acme.com --admin owner@acme.com [--assistant "Ava"]
 */

const { values } = parseArgs({
  options: {
    customer: { type: "string" },
    name: { type: "string" },
    assistant: { type: "string" },
    domain: { type: "string" },
    admin: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const customer = values.customer?.trim() ?? "";
if (!/^[a-z0-9][a-z0-9-]{0,30}$/.test(customer)) {
  fail("--customer is a short id: lowercase letters, digits and dashes.");
}
const domain = values.domain?.trim().toLowerCase() ?? "";
if (
  !/^[a-z0-9.-]+$/.test(domain) ||
  (!domain.includes(".") && domain !== "localhost")
) {
  fail("--domain is the host name people will open, such as crm.acme.com.");
}
const admin = values.admin?.trim().toLowerCase() ?? "";
if (!/^[^\s@]+@[^\s@]+$/.test(admin))
  fail("--admin is the first admin's email.");
if (!values.name?.trim())
  fail('--name is the product\'s name, such as "Acme CRM".');

const folder = resolve(import.meta.dir, "customers", customer);
if (existsSync(folder)) fail(`${folder} exists already.`);
mkdirSync(folder, { recursive: true });

const secret = (bytes = 32) => randomBytes(bytes).toString("base64");
const hex = (bytes = 32) => randomBytes(bytes).toString("hex");
const url = `https://${domain}`;

writeFileSync(
  join(folder, ".env"),
  `# ${values.name.trim()}: settings for this deployment. Secrets were generated; keep this file private.
CUSTOMER=${customer}
DOMAIN=${domain}
POSTGRES_PASSWORD=${hex(24)}

OPENBOT_PUBLIC_URL=${url}
BETTER_AUTH_URL=${url}
TRUSTED_ORIGINS=${url}
BETTER_AUTH_SECRET=${secret()}
KEY_ENCRYPTION_KEY=${secret()}
AGENT_TOOL_TOKEN=${hex()}
INITIAL_ADMIN_EMAILS=${admin}

# CopilotKit Intelligence (docs/deployment.md in openduet/openbot): the managed service by default.
INTELLIGENCE_API_URL=https://api.intelligence.copilotkit.ai
INTELLIGENCE_GATEWAY_WS_URL=wss://realtime.intelligence.copilotkit.ai

# Fill these in before the first start.
INTELLIGENCE_API_KEY=
# The model the assistant runs on: OPENAI_API_KEY, or another provider OpenDuet supports.
OPENAI_API_KEY=
# Removes CopilotKit's "Powered by CopilotKit" badge.
COPILOTKIT_LICENSE_TOKEN=
`,
  { mode: 0o600 },
);

const tenant = Bun.spawnSync(
  [
    "bun",
    resolve(import.meta.dir, "../scripts/make-tenant.ts"),
    "--name",
    values.name,
    ...(values.assistant ? ["--assistant", values.assistant] : []),
    "--out",
    join(folder, "tenant"),
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if (tenant.exitCode !== 0) fail("Could not write the tenant package.");

console.log(`
Next:
  1. Fill in INTELLIGENCE_API_KEY and a model key in ${join(folder, ".env")}.
  2. Point ${domain} at this machine, then run: agentic-crm/deploy/up.sh ${customer}
`);
