import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";

const OPENBOT_ROOT = path.resolve(__dirname, "..");
const GENERATED_CONFIG = path.join(
  __dirname,
  "src/lib/generated/application-config.ts",
);
const BRAND_MODULE = "tenant-brand";
const RESOLVED_BRAND_MODULE = `\0${BRAND_MODULE}`;

// Found the way scripts/generate-app-config.ts finds it.
function tenantDirectory(mode: string): string {
  const configured =
    process.env.TENANT_PACKAGE_DIR ??
    loadEnv(mode, OPENBOT_ROOT, "TENANT_PACKAGE_DIR").TENANT_PACKAGE_DIR;
  if (!configured) return path.join(OPENBOT_ROOT, "examples/openduet");
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(OPENBOT_ROOT, "server", configured);
}

// The name the app shows, from the config generated before every dev start and build.
function productName(): string | null {
  const generated = existsSync(GENERATED_CONFIG)
    ? readFileSync(GENERATED_CONFIG, "utf8")
    : "";
  const quoted = /"productName":\s*("(?:[^"\\]|\\.)*")/.exec(generated)?.[1];
  return quoted ? (JSON.parse(quoted) as string) : null;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

/*
 * The package's theme.css (validated when the app config is generated: only :root and .dark blocks of
 * approved variables) as one style. Light first, then dark, each one class stronger than the app's own
 * stylesheets so it wins whichever loads last.
 */
function themeStyle(directory: string): string | null {
  const file = path.join(directory, "theme.css");
  if (!existsSync(file)) return null;
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
  const blocks = [...css.matchAll(/(:root|\.dark)\s*\{([^{}<]*)\}/g)];
  const rules = (selector: string, strong: string) =>
    blocks
      .filter(([, found]) => found === selector)
      .map(([, , body]) => `${strong} {${body}}`);
  const style = [
    ...rules(":root", ":root:root"),
    ...rules(".dark", ":root.dark"),
  ].join("\n");
  return style || null;
}

/**
 * The deployment's name, logo and colors, from its tenant package: the page's title and favicon, which
 * index.html leaves as OpenDuet's, its theme.css, and the logo the CRM shows (`import logo from
 * "tenant-brand"`, null when the package has no logo.svg).
 */
export function tenantBrand(): Plugin {
  let logo: string | null = null;
  let theme: string | null = null;
  return {
    name: "tenant-brand",
    configResolved(config) {
      const directory = tenantDirectory(config.mode);
      theme = themeStyle(directory);
      const file = path.join(directory, "logo.svg");
      logo = existsSync(file)
        ? `data:image/svg+xml,${encodeURIComponent(readFileSync(file, "utf8"))}`
        : null;
    },
    resolveId: (source) =>
      source === BRAND_MODULE ? RESOLVED_BRAND_MODULE : null,
    load: (id) =>
      id === RESOLVED_BRAND_MODULE
        ? `export default ${JSON.stringify(logo)};`
        : null,
    transformIndexHtml(html) {
      const name = productName();
      const titled = name
        ? html.replace(
            /<title>[^<]*<\/title>/,
            `<title>${escapeHtml(name)}</title>`,
          )
        : html;
      const head = [
        ...(logo
          ? [`<link rel="icon" type="image/svg+xml" href="${logo}" />`]
          : []),
        ...(theme ? [`<style id="tenant-theme">\n${theme}\n</style>`] : []),
      ];
      return head.length
        ? titled.replace("</head>", `  ${head.join("\n  ")}\n  </head>`)
        : titled;
    },
  };
}
