import path from "node:path";
import {
  type Alias,
  normalizePath,
  type Plugin,
  searchForWorkspaceRoot,
} from "vite";

const ATOMIC_CRM_ROOT = path.resolve(__dirname, "../../../atomic-crm");
const ATOMIC_CRM_SOURCE = path.join(ATOMIC_CRM_ROOT, "src");
const CRM_EMBED_MODULE = "atomic-crm/embed";
const STAND_INS_MODULE = "atomic-crm/embed/stand-ins";

// Atomic modules served as its embed/standIns.tsx instead, which says why.
const REPLACED_MODULES = new Set(
  [
    "components/atomic-crm/providers/supabase/index.ts",
    "components/supabase/forgot-password-page.tsx",
    "components/supabase/oauth-consent-page.tsx",
    "components/supabase/set-password-page.tsx",
    "components/admin/theme-mode-toggle.tsx",
    "components/atomic-crm/misc/ChangelogPage.tsx",
  ].map((file) => normalizePath(path.join(ATOMIC_CRM_SOURCE, file))),
);

function isAtomicCrmSource(file: string | undefined): boolean {
  if (!file) return false;
  const [filePath = ""] = file.split("?");
  return path.resolve(filePath).startsWith(ATOMIC_CRM_SOURCE + path.sep);
}

/*
 * Atomic CRM and this app both import their own sources as `@/...`, so which tree `@/` means
 * depends on the importing file. An alias sees the importer only through its custom resolver.
 */
export function sourceAlias(appSource: string): Alias {
  return {
    find: /^@\/(.*)$/,
    replacement: "$1",
    customResolver(subpath, importer, options) {
      const root = isAtomicCrmSource(importer) ? ATOMIC_CRM_SOURCE : appSource;
      return this.resolve(path.join(root, subpath), importer, {
        ...options,
        skipSelf: true,
      });
    },
  };
}

/*
 * Compiles Atomic CRM's screens (agentic-crm/atomic-crm) into this app. They resolve their own
 * packages from Atomic's node_modules, except React, which must be this app's single copy.
 */
export function atomicCrm(appRoot: string): Plugin {
  return {
    name: "atomic-crm",
    enforce: "pre",
    config: () => ({
      resolve: { dedupe: ["react", "react-dom"] },
      server: {
        fs: { allow: [searchForWorkspaceRoot(appRoot), ATOMIC_CRM_ROOT] },
      },
    }),
    resolveId(source) {
      if (source === CRM_EMBED_MODULE) {
        return path.join(ATOMIC_CRM_SOURCE, "embed", "CrmEmbed.tsx");
      }
      if (source === STAND_INS_MODULE) {
        return path.join(ATOMIC_CRM_SOURCE, "embed", "standIns.tsx");
      }
      return null;
    },
    load(id) {
      return REPLACED_MODULES.has(normalizePath(id))
        ? `export * from ${JSON.stringify(STAND_INS_MODULE)};`
        : null;
    },
  };
}
