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

/**
 * The deployment's name and logo, from its tenant package: the page's title and favicon, which
 * index.html leaves as OpenDuet's, and the logo the CRM shows (`import logo from "tenant-brand"`,
 * null when the package has no logo.svg).
 */
export function tenantBrand(): Plugin {
  let logo: string | null = null;
  return {
    name: "tenant-brand",
    configResolved(config) {
      const file = path.join(tenantDirectory(config.mode), "logo.svg");
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
      return logo
        ? titled.replace(
            "</head>",
            `  <link rel="icon" type="image/svg+xml" href="${logo}" />\n  </head>`,
          )
        : titled;
    },
  };
}
