import type { Dashboard, SavedView } from "../types";

/** Where in the CRM a page is, for the sidebar's highlight and the tabs above it. */
export type Section =
  | { key: "home" | "records" | "reports" | "automations" | "settings" }
  | { key: "object"; object: string };

const OBJECT_PAGES = new Set(["contacts", "companies", "deals", "meetings"]);
const SETTINGS_PAGES = new Set(["settings", "profile", "sales", "import"]);

export function sectionOf(pathname: string): Section {
  const [first = "", second] = pathname.split("/").filter(Boolean);
  if (OBJECT_PAGES.has(first)) return { key: "object", object: first };
  if (first === "o") {
    return second ? { key: "object", object: second } : { key: "records" };
  }
  if (first === "reports") return { key: "reports" };
  if (first === "automations") return { key: "automations" };
  if (SETTINGS_PAGES.has(first)) return { key: "settings" };
  return { key: "home" };
}

export type Tab = { label: string; to: string };

// Atomic's own screen for an object, where it has one: the first tab.
const NATIVE: Record<string, Tab> = {
  contacts: { label: "List", to: "/contacts" },
  companies: { label: "List", to: "/companies" },
  deals: { label: "Pipeline", to: "/deals" },
  meetings: { label: "Upcoming", to: "/meetings" },
};

/** How many saved views show as tabs; the rest are under "More". */
export const SHOWN_VIEWS = 4;

export function objectTabs(
  object: string,
  layouts: { board: boolean; calendar: boolean },
  views: SavedView[],
): Tab[] {
  const base = `/o/${object}`;
  return [
    ...(NATIVE[object] ? [NATIVE[object]] : []),
    { label: "Table", to: base },
    ...(layouts.board ? [{ label: "Board", to: `${base}?layout=kanban` }] : []),
    ...(layouts.calendar
      ? [{ label: "Calendar", to: `${base}?layout=calendar` }]
      : []),
    ...views.map((view) => ({
      label: view.name,
      to: `${base}?view=${view.id}`,
    })),
  ];
}

export function settingsTabs(isAdmin: boolean): Tab[] {
  return [
    ...(isAdmin
      ? [
          { label: "General", to: "/settings" },
          { label: "Data model", to: "/settings/data-model" },
          { label: "Roles", to: "/settings/roles" },
          { label: "Sign-in", to: "/settings/sign-in" },
          { label: "People", to: "/sales" },
        ]
      : []),
    { label: "API keys", to: "/settings/api" },
    { label: "Profile", to: "/profile" },
  ];
}

export const reportTabs = (reports: Dashboard[]): Tab[] => [
  { label: "All reports", to: "/reports" },
  ...reports.map((report) => ({
    label: report.name,
    to: `/reports/${report.id}`,
  })),
];

export const HOME_TABS: Tab[] = [
  { label: "Dashboard", to: "/" },
  { label: "All records", to: "/o" },
];

export const AUTOMATION_TABS: Tab[] = [
  { label: "Automations", to: "/automations" },
];

/**
 * The tab a location is on: the one whose address it is, or for a page under a tab (a record, a
 * report's runs), the tab whose address its path starts with. A query only matches its own tab.
 */
export function activeTab(
  tabs: Tab[],
  pathname: string,
  search: string,
): Tab | undefined {
  const query = new URLSearchParams(search);
  const view = query.get("view");
  const layout = query.get("layout");
  const here = view
    ? `${pathname}?view=${view}`
    : layout
      ? `${pathname}?layout=${layout}`
      : pathname;
  return (
    tabs.find((tab) => tab.to === here) ??
    [...tabs]
      .filter((tab) => !tab.to.includes("?") && tab.to !== "/")
      .sort((one, other) => other.to.length - one.to.length)
      .find((tab) => pathname.startsWith(`${tab.to}/`))
  );
}
