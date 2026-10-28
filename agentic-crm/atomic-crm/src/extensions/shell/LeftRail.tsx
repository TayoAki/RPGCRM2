import { CanAccess } from "ra-core";
import { BarChart3, Bell, House, PanelLeft, Settings, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { UserMenu } from "@/components/admin/user-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  ImportFromJsonMenuItem,
  ProfileMenu,
  SettingsMenu,
  UsersMenu,
} from "../../components/atomic-crm/layout/Header";
import { GlobalSearchButton } from "../../components/atomic-crm/search/GlobalSearchButton";
import type { Section } from "./sections";

const RailButton = ({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
          active && "bg-muted text-foreground",
        )}
      >
        {children}
      </span>
    </TooltipTrigger>
    <TooltipContent side="right">{label}</TooltipContent>
  </Tooltip>
);

const RailLink = ({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof House;
  active: boolean;
}) => (
  <RailButton label={label} active={active}>
    <Link
      to={to}
      aria-label={label}
      className="flex size-full items-center justify-center"
    >
      <Icon className="size-5" />
    </Link>
  </RailButton>
);

type LeftRailProps = {
  section: Section;
  isAdmin: boolean;
  due: number;
  todayOpen: boolean;
  onToggleToday: () => void;
  onToggleSidebar: () => void;
};

/** The CRM's places that are always there: home, search, today, reports, automations, settings, you. */
export const LeftRail = ({
  section,
  isAdmin,
  due,
  todayOpen,
  onToggleToday,
  onToggleSidebar,
}: LeftRailProps) => (
  <nav
    aria-label="CRM"
    className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-secondary/60 py-2"
  >
    <RailButton label="Show or hide the menu">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Show or hide the menu"
        onClick={onToggleSidebar}
      >
        <PanelLeft className="size-5" />
      </Button>
    </RailButton>
    <RailLink
      to="/"
      label="Home"
      icon={House}
      active={section.key === "home"}
    />
    <RailButton label="Search (Ctrl K)">
      <GlobalSearchButton variant="icon" />
    </RailButton>
    <RailButton label={todayOpen ? "Hide today" : "Today"} active={todayOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={due ? `Today, ${due} tasks due` : "Today"}
        aria-pressed={todayOpen}
        className="relative"
        onClick={onToggleToday}
      >
        <Bell className="size-5" />
        {due ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {due > 99 ? "99+" : due}
          </span>
        ) : null}
      </Button>
    </RailButton>
    <RailLink
      to="/reports"
      label="Reports"
      icon={BarChart3}
      active={section.key === "reports"}
    />
    <RailLink
      to="/automations"
      label="Automations"
      icon={Zap}
      active={section.key === "automations"}
    />
    <RailLink
      to={isAdmin ? "/settings" : "/settings/api"}
      label="Settings"
      icon={Settings}
      active={section.key === "settings"}
    />
    <div className="mt-auto">
      <UserMenu>
        <ProfileMenu />
        <CanAccess resource="sales" action="list">
          <UsersMenu />
        </CanAccess>
        <CanAccess resource="configuration" action="edit">
          <SettingsMenu />
        </CanAccess>
        <ImportFromJsonMenuItem />
      </UserMenu>
    </div>
  </nav>
);
