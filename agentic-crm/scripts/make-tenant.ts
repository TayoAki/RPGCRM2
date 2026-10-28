#!/usr/bin/env bun
import {
  copyFileSync,
  cpSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

/*
 * Makes a branded tenant package for one deployment from OpenDuet's own (examples/openduet): the
 * product's name everywhere in the app, its logo (a square SVG), the assistant's name in chat, and
 * optionally its brand color (buttons, links, focus rings, in light and dark). Magpie CRM, its magpie
 * and Maggie unless told otherwise. Point TENANT_PACKAGE_DIR at the result. Run it again after a
 * vendor sync to pick up OpenDuet's changes to the package.
 *
 *   bun agentic-crm/scripts/make-tenant.ts --out <dir> [--name "Acme CRM"] [--assistant "Ava"]
 *     [--logo acme.svg] [--color "#4f46e5"] [--force]
 */

const SOURCE = resolve(
  import.meta.dir,
  "../openduet/openbot/examples/openduet",
);
const DEFAULT_LOGO = resolve(import.meta.dir, "../brand/magpie.svg");
const MAX_NAME = 40;

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    assistant: { type: "string" },
    logo: { type: "string" },
    color: { type: "string" },
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

const product = nameFrom(values.name ?? "Magpie CRM", "--name");
const assistant = nameFrom(
  values.assistant ?? (values.name ? product : "Maggie"),
  "--assistant",
);
const logo = resolve(values.logo ?? DEFAULT_LOGO);
if (!logo.endsWith(".svg") || !existsSync(logo)) {
  fail("--logo is an SVG file.");
}
const color = values.color?.trim().toLowerCase();
if (color !== undefined && !/^#[0-9a-f]{6}$/.test(color)) {
  fail('--color is a hex color such as "#4f46e5".');
}
if (!values.out) fail("Say where to write the package with --out.");
const out = resolve(values.out);
if (existsSync(out) && !values.force) {
  fail(`${out} exists. Pass --force to write over it.`);
}

const channels = (hex: string) =>
  [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
const toHex = (values: number[]) =>
  `#${values
    .map((value) =>
      Math.round(Math.min(1, Math.max(0, value)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

// WCAG relative luminance and contrast.
function luminance(hex: string) {
  const [red = 0, green = 0, blue = 0] = channels(hex).map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
const contrast = (one: string, other: string) => {
  const [light, dark] = [luminance(one), luminance(other)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};
const mix = (hex: string, with_: string, amount: number) => {
  const other = channels(with_);
  return toHex(
    channels(hex).map(
      (value, index) => value + ((other[index] ?? 0) - value) * amount,
    ),
  );
};
// The text on the color: white or near-black, whichever reads better.
const onColor = (hex: string) =>
  contrast(hex, "#ffffff") >= contrast(hex, "#0b0b0b") ? "#ffffff" : "#0b0b0b";

/** The brand color as the app's theme: as given in light mode, lifted until it shows on a dark page. */
function themeFor(hex: string) {
  let dark = hex;
  for (let step = 0; step < 10 && contrast(dark, "#171717") < 3; step += 1) {
    dark = mix(dark, "#ffffff", 0.15);
  }
  const block = (selector: string, value: string) =>
    [
      `${selector} {`,
      ...["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"].map(
        (variable) => `  ${variable}: ${value};`,
      ),
      ...["--primary-foreground", "--sidebar-primary-foreground"].map(
        (variable) => `  ${variable}: ${onColor(value)};`,
      ),
      "}",
    ].join("\n");
  return `/* Brand color ${hex}, from make-tenant.ts --color. */\n${block(":root", hex)}\n\n${block(".dark", dark)}\n`;
}

// A YAML double-quoted scalar is a JSON string.
const quoted = (text: string) => JSON.stringify(text);

function replaceOnce(file: string, from: string, to: string) {
  const path = join(out, file);
  const text = readFileSync(path, "utf8");
  const count = text.split(from).length - 1;
  if (count !== 1) {
    fail(
      `Expected "${from}" once in ${file}, found it ${count} times. OpenDuet's package changed.`,
    );
  }
  writeFileSync(path, text.replace(from, to));
}

cpSync(SOURCE, out, { recursive: true, force: true });
replaceOnce(
  "brand.yaml",
  "  product_name: OpenDuet\n",
  `  product_name: ${quoted(product)}\n`,
);
replaceOnce(
  "agents.yaml",
  "    name: OpenDuet\n",
  `    name: ${quoted(assistant)}\n`,
);
replaceOnce(
  "agents.yaml",
  "You are OpenDuet, a proactive",
  `You are ${assistant}, a proactive`,
);
replaceOnce(
  "channels.yaml",
  "    name: OpenDuet\n",
  `    name: ${quoted(assistant)}\n`,
);
copyFileSync(logo, join(out, "logo.svg"));
if (color) writeFileSync(join(out, "theme.css"), themeFor(color));
console.log(`Wrote ${out} for ${product}. Set TENANT_PACKAGE_DIR=${out}.`);
