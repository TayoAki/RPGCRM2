import {
  IconBell,
  IconBolt,
  IconBox,
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconChartBar,
  IconChecklist,
  IconDatabase,
  IconFileText,
  IconLayoutSidebarRight,
  IconListCheck,
  IconMessages,
  IconPlug,
  IconRepeat,
  IconRobot,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconSun,
  IconUsers,
  type TablerIcon,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  type LinkProps,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { initialOf } from "@/components/shell/header";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { type CrmSearchResult, crmSearchQueryOptions } from "@/lib/crm/queries";
import { appConfig } from "@/lib/generated/application-config";
import {
  connectionsQueryOptions,
  personalConnections,
} from "@/lib/plugins/queries";
import { cn } from "@/lib/utils";
import type { WorkspaceSummary } from "./use-workspace-summary";

type Place = {
  label: string;
  icon: TablerIcon;
  path: string;
  link: LinkProps;
  count?: number;
  // Also current for these paths, such as a task open over Bot work.
  match?: RegExp;
};

const crmPlace = (
  label: string,
  icon: TablerIcon,
  path: string,
  extra: Partial<Place> = {},
): Place => ({
  label,
  icon,
  path: `/crm/${path}`,
  link: { to: "/crm/$", params: { _splat: path } },
  ...extra,
});

const usePathname = () =>
  useRouterState({ select: (state) => state.location.pathname });

const isCurrent = (pathname: string, place: Place) =>
  place.match
    ? place.match.test(pathname)
    : pathname === place.path || pathname.startsWith(`${place.path}/`);

const RAIL_BUTTON =
  "relative grid size-10 place-items-center rounded-xl text-duet-ink-2 transition-colors hover:bg-duet-tile hover:text-duet-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40 aria-[current=page]:bg-duet-tile aria-[current=page]:text-duet-ink";

function Count({ value, className }: { value: number; className?: string }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "type-caption grid h-5 min-w-5 place-items-center rounded-full bg-duet-accent px-1 font-semibold text-duet-on-accent tabular-nums",
        className,
      )}
    >
      {value}
    </span>
  );
}

/** Places that are always there: home, search, conversations, what's waiting, reports, settings. */
export function DesktopRail({
  summary,
  onConversations,
  panelOpen,
  onTogglePanel,
}: {
  summary: WorkspaceSummary;
  onConversations: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const pathname = usePathname();
  const navigate = useNavigate();
  const { data: user } = useQuery(currentUserQueryOptions());
  const [searching, setSearching] = useState(false);
  const rail: Place[] = [
    { label: "Today", icon: IconSun, path: "/today", link: { to: "/today" } },
    crmPlace("Reports", IconChartBar, "reports"),
    crmPlace("Automations", IconBolt, "automations"),
  ];
  return (
    <nav
      aria-label="Shortcuts"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-duet-hair border-r bg-duet-card py-3"
    >
      <Link
        aria-label={`${appConfig.brand.productName} home`}
        className="mb-2 grid size-9 place-items-center rounded-xl bg-duet-black font-semibold text-duet-on-black"
        to="/today"
      >
        {appConfig.brand.productName.charAt(0)}
      </Link>
      <RailLink pathname={pathname} place={rail[0]} />
      <button
        aria-label="Search"
        className={RAIL_BUTTON}
        onClick={() => setSearching(true)}
        type="button"
      >
        <IconSearch size={20} stroke={1.75} />
      </button>
      <button
        aria-label="Conversations"
        className={RAIL_BUTTON}
        onClick={onConversations}
        type="button"
      >
        <IconMessages size={20} stroke={1.75} />
      </button>
      <Link
        aria-label={
          summary.waiting
            ? `Waiting on you, ${summary.waiting}`
            : "Waiting on you"
        }
        className={RAIL_BUTTON}
        to="/tasks"
      >
        <IconBell size={20} stroke={1.75} />
        <Count
          className="absolute -top-0.5 -right-0.5 h-4 min-w-4 text-[10px]"
          value={summary.waiting}
        />
      </Link>
      <RailLink pathname={pathname} place={rail[1]} />
      <RailLink pathname={pathname} place={rail[2]} />
      <div className="flex-1" />
      <button
        aria-label={panelOpen ? "Hide the assistant" : "Show the assistant"}
        aria-pressed={panelOpen}
        className={RAIL_BUTTON}
        onClick={onTogglePanel}
        type="button"
      >
        <IconLayoutSidebarRight size={20} stroke={1.75} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Settings" className={RAIL_BUTTON}>
          <IconSettings size={20} stroke={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right">
          <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
            Your settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              void navigate({ to: "/crm/$", params: { _splat: "settings" } })
            }
          >
            CRM settings
          </DropdownMenuItem>
          {user?.role === "admin" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void navigate({ to: "/admin" })}>
                Admin
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Link
        aria-label="Your settings"
        className="type-label mt-1 grid size-9 place-items-center rounded-full bg-duet-tile font-semibold text-duet-ink"
        to="/settings"
      >
        {user ? initialOf(user) : null}
      </Link>
      <SearchDialog onOpenChange={setSearching} open={searching} />
    </nav>
  );
}

function RailLink({ place, pathname }: { place: Place; pathname: string }) {
  const Icon = place.icon;
  return (
    <Link
      {...place.link}
      activeOptions={{ exact: true }}
      aria-current={isCurrent(pathname, place) ? "page" : undefined}
      aria-label={place.label}
      className={RAIL_BUTTON}
      title={place.label}
    >
      <Icon size={20} stroke={1.75} />
    </Link>
  );
}

const SECTION_TITLE =
  "type-caption px-2 pt-4 pb-1 font-medium text-duet-ink-3 uppercase tracking-wide";

/** The workspace, the assistant's places, the CRM's records and the setup pages. */
export function DesktopSidebar({ summary }: { summary: WorkspaceSummary }) {
  const pathname = usePathname();
  const connections = useQuery(connectionsQueryOptions());
  const connected = personalConnections(
    connections.data?.connections ?? [],
  ).filter((connection) => !connection.revoked).length;
  const company = summary.config?.title || appConfig.brand.productName;
  const assistant: Place[] = [
    { label: "Today", icon: IconSun, path: "/today", link: { to: "/today" } },
    {
      label: "Chat",
      icon: IconMessages,
      path: "/",
      link: { to: "/" },
      match: /^\/(channels\/[^/]+)?$/,
    },
    {
      label: "Bot work",
      icon: IconListCheck,
      path: "/tasks",
      link: { to: "/tasks" },
      count: summary.waiting,
    },
    { label: "Make", icon: IconSparkles, path: "/make", link: { to: "/make" } },
  ];
  const crm: Place[] = [
    crmPlace("Contacts", IconUsers, "contacts"),
    crmPlace("Companies", IconBuilding, "companies"),
    crmPlace("Deals", IconBriefcase, "deals"),
    crmPlace("Meetings", IconCalendarEvent, "meetings"),
    crmPlace("Follow-ups", IconChecklist, "o/tasks", {
      count: summary.followUpsDue.length,
    }),
    crmPlace("Proposals", IconFileText, "o/proposals"),
    crmPlace("All records", IconDatabase, "o", { match: /^\/crm\/o\/?$/ }),
  ];
  const workspace: Place[] = [
    { label: "Bots", icon: IconRobot, path: "/bots", link: { to: "/bots" } },
    {
      label: "Connections",
      icon: IconPlug,
      path: "/connections",
      link: { to: "/connections" },
    },
    {
      label: "Capabilities",
      icon: IconBox,
      path: "/capabilities",
      link: { to: "/capabilities" },
    },
    {
      label: "Routines",
      icon: IconRepeat,
      path: "/routines",
      link: { to: "/routines" },
    },
  ];
  return (
    <nav
      aria-label="Main"
      className="flex w-60 shrink-0 flex-col border-duet-hair border-r bg-duet-card"
    >
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-duet-accent-soft font-semibold text-duet-accent">
          {company.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="type-label truncate font-semibold text-duet-ink">
            {company}
          </p>
          <p className="type-caption truncate text-duet-ink-2">
            {company === appConfig.brand.productName
              ? "Your workspace"
              : `${appConfig.brand.productName} workspace`}
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <SidebarGroup pathname={pathname} places={assistant} />
        <SidebarGroup pathname={pathname} places={crm} title="CRM" />
        <SidebarGroup
          pathname={pathname}
          places={workspace}
          title="Workspace"
        />
      </div>
      <Link
        className="type-caption flex items-center gap-2 border-duet-hair border-t px-4 py-3 text-duet-ink-2 hover:text-duet-ink"
        to="/connections"
      >
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            connected ? "bg-duet-green" : "bg-duet-ink-3",
          )}
        />
        {connected === 1 ? "1 app connected" : `${connected} apps connected`}
      </Link>
    </nav>
  );
}

function SidebarGroup({
  title,
  places,
  pathname,
}: {
  title?: string;
  places: Place[];
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {title ? (
        <h2 className={SECTION_TITLE}>{title}</h2>
      ) : (
        <div className="h-2" />
      )}
      {places.map((place) => (
        <SidebarLink
          current={isCurrent(pathname, place)}
          key={place.path}
          place={place}
        />
      ))}
    </div>
  );
}

function SidebarLink({ place, current }: { place: Place; current: boolean }) {
  const Icon = place.icon;
  return (
    <Link
      {...place.link}
      activeOptions={{ exact: true }}
      aria-current={current ? "page" : undefined}
      className={cn(
        "type-label flex h-9 items-center gap-2.5 rounded-lg px-2 text-duet-ink-2 transition-colors hover:bg-duet-tile hover:text-duet-ink",
        current && "bg-duet-tile font-medium text-duet-ink",
      )}
    >
      <Icon className="shrink-0" size={18} stroke={1.75} />
      <span className="min-w-0 flex-1 truncate">{place.label}</span>
      {place.count ? <Count value={place.count} /> : null}
    </Link>
  );
}

const RESULT_PATH: Record<string, string> = {
  contacts: "contacts",
  companies: "companies",
  deals: "deals",
};

const RESULT_KIND: Record<string, string> = {
  contacts: "Contact",
  companies: "Company",
  deals: "Deal",
};

function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState("");
  const navigate = useNavigate();
  const results = useQuery(crmSearchQueryOptions(text));
  const go = (result: CrmSearchResult) => {
    onOpenChange(false);
    setText("");
    void navigate({
      to: "/crm/$",
      params: {
        _splat: `${RESULT_PATH[result.resource]}/${result.record_id}/show`,
      },
    });
  };
  let body: ReactNode = (
    <p className="type-sub px-2 py-6 text-center text-duet-ink-2">
      Find contacts, companies and deals.
    </p>
  );
  if (text.trim().length > 1 && results.data) {
    body = results.data.length ? (
      <ul className="flex flex-col gap-0.5">
        {results.data.map((result) => (
          <li key={`${result.resource}-${result.record_id}`}>
            <button
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-duet-tile focus-visible:bg-duet-tile focus-visible:outline-none"
              onClick={() => go(result)}
              type="button"
            >
              <span className="type-caption w-16 shrink-0 text-duet-ink-3">
                {RESULT_KIND[result.resource]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-label block truncate text-duet-ink">
                  {result.title || "Untitled"}
                </span>
                {result.subtitle ? (
                  <span className="type-caption block truncate text-duet-ink-2">
                    {result.subtitle}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="type-sub px-2 py-6 text-center text-duet-ink-2">
        Nothing matches "{text.trim()}".
      </p>
    );
  }
  if (results.isError) {
    body = (
      <p className="type-sub px-2 py-6 text-center text-duet-red" role="alert">
        Couldn't search the CRM. Try again.
      </p>
    );
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="top-[20%] max-w-lg translate-y-0 p-3">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Input
          aria-label="Search the CRM"
          autoFocus
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            const first = results.data?.[0];
            if (event.key === "Enter" && first) go(first);
          }}
          placeholder="Search contacts, companies and deals"
          value={text}
        />
        <div className="mt-2 max-h-80 overflow-y-auto">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
