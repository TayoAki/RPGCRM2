import { IconAdjustments } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  PageChromeProvider,
  usePageChromeState,
} from "@/components/shell/page-chrome";
import type { ShellTab } from "@/components/shell/tab-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { agoShort } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { AssistantPanel } from "./assistant-panel";
import { DesktopRail, DesktopSidebar } from "./desktop-nav";
import {
  useWorkspaceSummary,
  type WorkspaceSummary,
} from "./use-workspace-summary";

const PANEL_STORAGE_KEY = "magpie.desktop-assistant";

const TAB_NAMES: Record<ShellTab, string> = {
  chat: "Chat",
  tasks: "Bot work",
  make: "Make",
};

const CRM_SECTIONS: Record<string, string> = {
  contacts: "Contacts",
  companies: "Companies",
  deals: "Deals",
  meetings: "Meetings",
  reports: "Reports",
  automations: "Automations",
  settings: "Settings",
  sales: "People",
  profile: "Profile",
};

/** Where the page sits, as the header's breadcrumb: the area, then the page. */
export function breadcrumbFor(
  pathname: string,
  tab: ShellTab | null,
  title: string | null,
): [string, string] {
  if (pathname === "/today") return ["Workspace", "Today"];
  if (tab) return ["Workspace", TAB_NAMES[tab]];
  const crm = pathname.match(/^\/crm(?:\/([^/]+)(?:\/([^/]+))?)?/);
  if (crm) {
    const [, section, object] = crm;
    if (!section) return ["CRM", "Dashboard"];
    if (section === "o") {
      if (object === "tasks") return ["CRM", "Follow-ups"];
      if (object === "proposals") return ["CRM", "Proposals"];
      return ["CRM", object ? (title ?? "Records") : "All records"];
    }
    return ["CRM", CRM_SECTIONS[section] ?? "CRM"];
  }
  if (pathname.startsWith("/admin")) return ["Admin", title ?? "Admin"];
  return ["Workspace", title ?? "Page"];
}

function rememberedPanel(): boolean {
  try {
    return window.localStorage.getItem(PANEL_STORAGE_KEY) !== "closed";
  } catch {
    return true;
  }
}

function rememberPanel(open: boolean) {
  try {
    window.localStorage.setItem(PANEL_STORAGE_KEY, open ? "open" : "closed");
  } catch {
    // Storage can be unavailable; the panel still toggles for this visit.
  }
}

/**
 * The app on a wide screen: a rail of shortcuts, a sidebar of places, the page under a header with
 * its breadcrumb, the assistant on the right, and a status bar along the foot.
 */
export function DesktopShell({
  tab,
  onConversations,
  children,
}: {
  tab: ShellTab | null;
  onConversations: () => void;
  children: ReactNode;
}) {
  const summary = useWorkspaceSummary();
  const [panelOpen, setPanelOpen] = useState(rememberedPanel);
  const togglePanel = (open: boolean) => {
    rememberPanel(open);
    setPanelOpen(open);
  };
  return (
    <PageChromeProvider docked>
      <div className="duet-face flex min-h-0 flex-1 flex-col text-duet-ink">
        <div className="flex min-h-0 flex-1">
          <DesktopRail
            onConversations={onConversations}
            onTogglePanel={() => togglePanel(!panelOpen)}
            panelOpen={panelOpen}
            summary={summary}
          />
          <DesktopSidebar summary={summary} />
          <DesktopMain
            onClosePanel={() => togglePanel(false)}
            panelOpen={panelOpen}
            summary={summary}
            tab={tab}
          >
            {children}
          </DesktopMain>
        </div>
        <StatusBar summary={summary} />
      </div>
    </PageChromeProvider>
  );
}

function DesktopMain({
  tab,
  summary,
  panelOpen,
  onClosePanel,
  children,
}: {
  tab: ShellTab | null;
  summary: WorkspaceSummary;
  panelOpen: boolean;
  onClosePanel: () => void;
  children: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const chrome = usePageChromeState();
  const [area, page] = breadcrumbFor(pathname, tab, chrome?.title ?? null);
  const narrow =
    tab === "chat" || tab === "tasks" || chrome?.column === "phone";
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col bg-duet-surface">
        <header className="flex h-12 shrink-0 items-center gap-3 border-duet-hair border-b bg-duet-card px-5">
          <nav
            aria-label="Breadcrumb"
            className="type-label flex min-w-0 flex-1 items-center gap-1.5"
          >
            <span className="text-duet-ink-2">{area}</span>
            <span aria-hidden className="text-duet-ink-3">
              /
            </span>
            <span
              aria-current="page"
              className="truncate font-medium text-duet-ink"
            >
              {page}
            </span>
          </nav>
          {chrome?.actions ? (
            <div className="shrink-0 scale-75">{chrome.actions}</div>
          ) : null}
          <CustomizeMenu />
        </header>
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden [--duet-head-space:24px] [--duet-tab-space:16px]",
            narrow && "mx-auto w-full max-w-3xl",
          )}
        >
          {children}
        </main>
      </div>
      {panelOpen ? (
        <AssistantPanel onClose={onClosePanel} place={page} summary={summary} />
      ) : null}
    </>
  );
}

/** Ways to shape the workspace: a page a Bot builds, a report, or a field and object of your own. */
function CustomizeMenu() {
  const navigate = useNavigate();
  const { data: user } = useQuery(currentUserQueryOptions());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="type-label flex h-8 items-center gap-1.5 rounded-lg border border-duet-hair px-2.5 text-duet-ink hover:bg-duet-tile">
        <IconAdjustments size={16} stroke={1.75} />
        Customize
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void navigate({ to: "/make" })}>
          Build a page with a Bot
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void navigate({ to: "/crm/$", params: { _splat: "reports" } })
          }
        >
          New report
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void navigate({ to: "/crm/$", params: { _splat: "o" } })
          }
        >
          Saved views
        </DropdownMenuItem>
        {user?.role === "admin" ? (
          <DropdownMenuItem
            onClick={() =>
              void navigate({
                to: "/crm/$",
                params: { _splat: "settings/data-model" },
              })
            }
          >
            Fields and objects
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

function StatusBar({ summary }: { summary: WorkspaceSummary }) {
  const now = useNow(30_000);
  const working = summary.working.length;
  return (
    <footer className="type-caption flex h-7 shrink-0 items-center gap-4 border-duet-hair border-t bg-duet-card px-4 text-duet-ink-2">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            summary.syncFailed ? "bg-duet-amber" : "bg-duet-green",
          )}
        />
        {summary.syncFailed ? "Can't reach the workspace" : "Workspace synced"}
      </span>
      <span>{working === 1 ? "1 Bot working" : `${working} Bots working`}</span>
      <span className="ml-auto">
        {summary.syncedAt
          ? `Last synced ${agoShort(new Date(summary.syncedAt).toISOString(), now)}`
          : null}
      </span>
    </footer>
  );
}
