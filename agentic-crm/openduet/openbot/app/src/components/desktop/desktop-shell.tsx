import {
  IconBell,
  IconLayoutSidebarRightExpand,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  PageChromeProvider,
  usePageChromeState,
} from "@/components/shell/page-chrome";
import type { ShellTab } from "@/components/shell/tab-bar";
import { StarterDialog, type StarterId } from "@/components/today/starters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { agoShort } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { AssistantPanel } from "./assistant-panel";
import { DesktopSidebar } from "./desktop-nav";
import { SearchDialog } from "./search-dialog";
import {
  useWorkspaceSummary,
  type WorkspaceSummary,
} from "./use-workspace-summary";

const PANEL_STORAGE_KEY = "magpie.desktop-assistant";

const TAB_NAMES: Record<ShellTab, string> = {
  chat: "Chat",
  tasks: "Inbox",
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

/** Where the page sits: the area, then the page. */
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
 * The app on a wide screen: one sidebar for every place, the page under a header with search and
 * New, the assistant on the right, and a status bar along the foot.
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
  const [searching, setSearching] = useState(false);
  const [starter, setStarter] = useState<StarterId | null>(null);
  const askRef = useRef<HTMLTextAreaElement>(null);
  const togglePanel = (open: boolean) => {
    rememberPanel(open);
    setPanelOpen(open);
  };
  const askBot = () => {
    togglePanel(true);
    // The panel may only now be mounting; focus once it has.
    window.requestAnimationFrame(() => askRef.current?.focus());
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <PageChromeProvider docked>
      <div className="duet-face flex min-h-0 flex-1 flex-col text-duet-ink">
        <div className="flex min-h-0 flex-1">
          <DesktopSidebar onConversations={onConversations} summary={summary} />
          <DesktopMain
            askRef={askRef}
            onAskBot={askBot}
            onPanel={togglePanel}
            onSearch={() => setSearching(true)}
            onStarter={setStarter}
            panelOpen={panelOpen}
            summary={summary}
            tab={tab}
          >
            {children}
          </DesktopMain>
        </div>
        <StatusBar summary={summary} />
      </div>
      <SearchDialog onOpenChange={setSearching} open={searching} />
      <StarterDialog onClose={() => setStarter(null)} starter={starter} />
    </PageChromeProvider>
  );
}

function DesktopMain({
  tab,
  summary,
  panelOpen,
  onPanel,
  onSearch,
  onAskBot,
  onStarter,
  askRef,
  children,
}: {
  tab: ShellTab | null;
  summary: WorkspaceSummary;
  panelOpen: boolean;
  onPanel: (open: boolean) => void;
  onSearch: () => void;
  onAskBot: () => void;
  onStarter: (starter: StarterId) => void;
  askRef: RefObject<HTMLTextAreaElement | null>;
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-duet-hair border-b bg-duet-card px-6">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-1 items-center gap-1.5"
          >
            {area === "Workspace" ? null : (
              <>
                <span className="type-label text-duet-ink-2">{area}</span>
                <span aria-hidden className="type-label text-duet-ink-3">
                  /
                </span>
              </>
            )}
            <span
              aria-current="page"
              className="type-label truncate font-semibold text-duet-ink"
            >
              {page}
            </span>
          </nav>
          {chrome?.actions ? (
            <div className="shrink-0 scale-75">{chrome.actions}</div>
          ) : null}
          <button
            className="type-label flex h-9 w-64 items-center gap-2 rounded-lg border border-duet-hair bg-duet-surface px-3 text-duet-ink-3 hover:border-duet-ink-3"
            onClick={onSearch}
            type="button"
          >
            <IconSearch className="shrink-0" size={16} stroke={1.75} />
            <span className="flex-1 text-left">Search workspace…</span>
            <kbd className="type-caption rounded border border-duet-hair px-1 font-sans text-duet-ink-3">
              ⌘K
            </kbd>
          </button>
          <NewMenu onAskBot={onAskBot} />
          <Link
            aria-label={
              summary.waiting
                ? `Inbox, ${summary.waiting} waiting`
                : "Inbox, nothing waiting"
            }
            className="relative grid size-9 place-items-center rounded-lg text-duet-ink-2 hover:bg-duet-tile hover:text-duet-ink"
            to="/tasks"
          >
            <IconBell size={19} stroke={1.75} />
            {summary.waiting ? (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-duet-red ring-2 ring-duet-card" />
            ) : null}
          </Link>
          {panelOpen ? null : (
            <button
              aria-label="Show the assistant"
              className="grid size-9 place-items-center rounded-lg text-duet-ink-2 hover:bg-duet-tile hover:text-duet-ink"
              onClick={() => onPanel(true)}
              type="button"
            >
              <IconLayoutSidebarRightExpand size={19} stroke={1.75} />
            </button>
          )}
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
        <AssistantPanel
          askRef={askRef}
          onClose={() => onPanel(false)}
          onStarter={onStarter}
          place={page}
          summary={summary}
        />
      ) : null}
    </>
  );
}

/** Make something new: a record, a page, a report, or work for a Bot. */
function NewMenu({ onAskBot }: { onAskBot: () => void }) {
  const navigate = useNavigate();
  const crm = (path: string) =>
    void navigate({ to: "/crm/$", params: { _splat: path } });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="type-label flex h-9 items-center gap-1.5 rounded-lg border border-duet-accent/30 px-3 font-medium text-duet-accent hover:bg-duet-accent-soft">
        <IconPlus size={16} stroke={2} />
        New
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => crm("contacts/create")}>
          Contact
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => crm("companies/create")}>
          Company
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => crm("deals/create")}>
          Deal
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAskBot}>Task for a Bot</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void navigate({ to: "/make" })}>
          Page made by a Bot
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => crm("reports")}>
          Report
        </DropdownMenuItem>
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
  let state = summary.empty ? "Workspace ready" : "Workspace synced";
  if (summary.syncFailed) state = "Can't reach the workspace";
  return (
    <footer className="type-caption flex h-8 shrink-0 items-center gap-4 border-duet-hair border-t bg-duet-card px-4 text-duet-ink-2">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            summary.syncFailed ? "bg-duet-amber" : "bg-duet-green",
          )}
        />
        {state}
      </span>
      {working ? (
        <span>
          {working === 1 ? "1 Bot working" : `${working} Bots working`}
        </span>
      ) : null}
      <span className="ml-auto">
        {summary.appsConnected === 0
          ? "No apps connected"
          : summary.syncedAt
            ? `Last synced ${agoShort(new Date(summary.syncedAt).toISOString(), now)}`
            : null}
      </span>
    </footer>
  );
}
