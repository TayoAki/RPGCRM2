import {
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconCheckbox,
  IconChevronDown,
  IconChevronRight,
  IconDatabase,
  IconDots,
  IconFileText,
  IconHome,
  IconInbox,
  IconMessages,
  IconPlug,
  IconRepeat,
  IconRobot,
  IconSettings,
  IconSparkles,
  IconUsers,
  type TablerIcon,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Link,
  type LinkProps,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { initialOf } from "@/components/shell/header";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { crmBrand } from "@/crm/brand";
import { signOutMutationOptions } from "@/lib/auth/mutations";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";
import { appConfig } from "@/lib/generated/application-config";
import { cn } from "@/lib/utils";
import { queryClient } from "@/query-client";
import type { WorkspaceSummary } from "./use-workspace-summary";

type Place = {
  label: string;
  icon: TablerIcon;
  path: string;
  link: LinkProps;
  count?: number;
  // Also current for these paths, such as a conversation open under Chat.
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

const isCurrent = (pathname: string, place: Place) =>
  place.match
    ? place.match.test(pathname)
    : pathname === place.path || pathname.startsWith(`${place.path}/`);

const ROW =
  "type-label flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-duet-ink-2 transition-colors hover:bg-duet-tile hover:text-duet-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40";

const BRAND = crmBrand();

/** The one navigation: places, the CRM's records, tools, and the person's settings at the foot. */
export function DesktopSidebar({
  summary,
  onConversations,
}: {
  summary: WorkspaceSummary;
  onConversations: () => void;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const navigate = useNavigate();
  const { data: user } = useQuery(currentUserQueryOptions());
  const admin = user?.role === "admin";
  const main: Place[] = [
    { label: "Today", icon: IconHome, path: "/today", link: { to: "/today" } },
    {
      label: "Inbox",
      icon: IconInbox,
      path: "/tasks",
      link: { to: "/tasks" },
      count: summary.waiting,
    },
    {
      label: "Chat",
      icon: IconMessages,
      path: "/",
      link: { to: "/" },
      match: /^\/(channels\/[^/]+)?$/,
    },
    { label: "Make", icon: IconSparkles, path: "/make", link: { to: "/make" } },
  ];
  const crm: Place[] = [
    crmPlace("Contacts", IconUsers, "contacts"),
    crmPlace("Companies", IconBuilding, "companies"),
    crmPlace("Deals", IconBriefcase, "deals"),
    crmPlace("Meetings", IconCalendarEvent, "meetings"),
    crmPlace("Follow-ups", IconCheckbox, "o/tasks", {
      count: summary.followUpsDue.length,
    }),
    crmPlace("Proposals", IconFileText, "o/proposals"),
    crmPlace("All records", IconDatabase, "o", { match: /^\/crm\/o\/?$/ }),
  ];
  const tools: Place[] = [
    { label: "Bots", icon: IconRobot, path: "/bots", link: { to: "/bots" } },
    {
      label: "Connections",
      icon: IconPlug,
      path: "/connections",
      link: { to: "/connections" },
    },
    {
      label: "Routines",
      icon: IconRepeat,
      path: "/routines",
      link: { to: "/routines" },
    },
  ];
  const crmPage = (path: string) =>
    void navigate({ to: "/crm/$", params: { _splat: path } });
  return (
    <nav
      aria-label="Main"
      className="flex w-60 shrink-0 flex-col border-duet-hair border-r bg-duet-card"
    >
      <WorkspaceMenu summary={summary} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <Group pathname={pathname} places={main} />
        <Group pathname={pathname} places={crm} title="CRM" />
        <Group pathname={pathname} places={tools} title="Tools">
          <DropdownMenu>
            <DropdownMenuTrigger className={ROW}>
              <IconDots className="shrink-0" size={18} stroke={1.75} />
              <span className="min-w-0 flex-1 truncate text-left">
                More tools
              </span>
              <IconChevronRight className="shrink-0" size={14} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <DropdownMenuItem
                onClick={() => void navigate({ to: "/capabilities" })}
              >
                Capabilities
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => crmPage("reports")}>
                Reports
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => crmPage("automations")}>
                Automations
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onConversations}>
                Conversations
              </DropdownMenuItem>
              {admin ? (
                <DropdownMenuItem
                  onClick={() => crmPage("settings/data-model")}
                >
                  Fields and objects
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </Group>
      </div>
      <div className="flex flex-col gap-0.5 border-duet-hair border-t px-3 py-3">
        <Link className={ROW} to="/connections">
          <IconPlug className="shrink-0" size={18} stroke={1.75} />
          <span className="type-caption">
            {summary.appsConnected === 1
              ? "1 app connected"
              : `${summary.appsConnected} apps connected`}
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className={ROW}>
            <IconSettings className="shrink-0" size={18} stroke={1.75} />
            <span className="min-w-0 flex-1 truncate text-left">Settings</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem
              onClick={() => void navigate({ to: "/settings" })}
            >
              Your settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => crmPage("settings")}>
              CRM settings
            </DropdownMenuItem>
            {admin ? (
              <DropdownMenuItem onClick={() => void navigate({ to: "/admin" })}>
                Admin
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link className={cn(ROW, "mt-1 h-10")} to="/settings">
          <span className="type-caption grid size-7 shrink-0 place-items-center rounded-full bg-duet-tile font-semibold text-duet-ink">
            {user ? initialOf(user) : null}
          </span>
          <span className="min-w-0 flex-1 truncate text-duet-ink">
            {user?.name || user?.email}
          </span>
        </Link>
      </div>
    </nav>
  );
}

/** The product and workspace at the top, with what belongs to the whole workspace. */
function WorkspaceMenu({ summary }: { summary: WorkspaceSummary }) {
  const navigate = useNavigate();
  const { resolved } = useTheme();
  const { data: user } = useQuery(currentUserQueryOptions());
  const { data: capabilities } = useQuery(deploymentCapabilitiesQueryOptions());
  const signOut = useMutation(signOutMutationOptions(queryClient));
  const company = summary.config?.title;
  const workspace =
    company && company !== appConfig.brand.productName
      ? company
      : "Your workspace";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="m-3 mb-2 flex items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-duet-tile focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-duet-accent/40">
        <img
          alt=""
          className="size-8 shrink-0 rounded-lg"
          src={resolved === "dark" ? BRAND.darkModeLogo : BRAND.lightModeLogo}
        />
        <span className="min-w-0 flex-1">
          <span className="type-label block truncate font-semibold text-duet-ink">
            {appConfig.brand.productName}
          </span>
          <span className="type-caption flex items-center gap-1 text-duet-ink-2">
            <span className="truncate">{workspace}</span>
            <IconChevronDown className="shrink-0" size={12} />
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem
          onClick={() =>
            void navigate({ to: "/crm/$", params: { _splat: "settings" } })
          }
        >
          Workspace settings
        </DropdownMenuItem>
        {user?.role === "admin" ? (
          <>
            <DropdownMenuItem
              onClick={() =>
                void navigate({ to: "/crm/$", params: { _splat: "sales" } })
              }
            >
              Invite people
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void navigate({ to: "/admin" })}>
              Admin
            </DropdownMenuItem>
          </>
        ) : null}
        {capabilities?.localEvaluation === false ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                signOut.mutate(undefined, {
                  onSuccess: () => void navigate({ to: "/sign" }),
                })
              }
            >
              Sign out
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Group({
  title,
  places,
  pathname,
  children,
}: {
  title?: string;
  places: Place[];
  pathname: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {title ? (
        <h2 className="type-caption px-2 pt-5 pb-1 font-medium text-duet-ink-3">
          {title}
        </h2>
      ) : null}
      {places.map((place) => (
        <PlaceLink
          current={isCurrent(pathname, place)}
          key={place.path}
          place={place}
        />
      ))}
      {children}
    </div>
  );
}

function PlaceLink({ place, current }: { place: Place; current: boolean }) {
  const Icon = place.icon;
  return (
    <Link
      {...place.link}
      activeOptions={{ exact: true }}
      aria-current={current ? "page" : undefined}
      className={cn(ROW, current && "bg-duet-tile font-medium text-duet-ink")}
    >
      <Icon className="shrink-0" size={18} stroke={1.75} />
      <span className="min-w-0 flex-1 truncate">{place.label}</span>
      {place.count ? (
        <span className="type-caption min-w-5 rounded-full bg-duet-tile px-1.5 text-center font-medium text-duet-ink tabular-nums">
          {place.count}
        </span>
      ) : null}
    </Link>
  );
}
