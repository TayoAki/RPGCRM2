#!/usr/bin/env bun
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

/*
 * Makes a branded tenant package for one deployment from OpenDuet's own (examples/openduet): the
 * product name everywhere in the app, and the assistant's name in chat. Point TENANT_PACKAGE_DIR at
 * the result. Run it again after a vendor sync to pick up OpenDuet's changes to the package.
 *
 *   bun agentic-crm/scripts/make-tenant.ts --name "Acme CRM" [--assistant "Ava"] --out <dir> [--force]
 */

const SOURCE = resolve(import.meta.dir, "../openduet/openbot/examples/openduet");
const MAX_NAME = 40;

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    assistant: { type: "string" },
    out: { type: "string" },
    force: { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function nameFrom(value: string | undefined, what: string): string {
  const name = value?.trim() ?? "";
  if (!name || name.length > MAX_NAME || /[\p{Cc}]/u.test(name)) {
    fail(`${what} must be 1 to ${MAX_NAME} characters on one line.`);
  }
  return name;
}

const product = nameFrom(values.name, "--name");
const assistant = nameFrom(values.assistant ?? product, "--assistant");
if (!values.out) fail("Say where to write the package with --out.");
const out = resolve(values.out);
if (existsSync(out) && !values.force) {
  fail(`${out} exists. Pass --force to write over it.`);
}

// A YAML double-quoted scalar is a JSON string.
const quoted = (text: string) => JSON.stringify(text);

function replaceOnce(file: string, from: string, to: string) {
  const path = join(out, file);
  const text = readFileSync(path, "utf8");
  const count = text.split(from).length - 1;
  if (count !== 1) {
    fail(`Expected "${from}" once in ${file}, found it ${count} times. OpenDuet's package changed.`);
  }
  writeFileSync(path, text.replace(from, to));
}

cpSync(SOURCE, out, { recursive: true, force: true });
replaceOnce("brand.yaml", "  product_name: OpenDuet\n", `  product_name: ${quoted(product)}\n`);
replaceOnce("agents.yaml", "    name: OpenDuet\n", `    name: ${quoted(assistant)}\n`);
replaceOnce("agents.yaml", "You are OpenDuet, a proactive", `You are ${assistant}, a proactive`);
replaceOnce("channels.yaml", "    name: OpenDuet\n", `    name: ${quoted(assistant)}\n`);
console.log(`Wrote ${out} for ${product}. Set TENANT_PACKAGE_DIR=${out}.`);
