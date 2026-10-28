import { useQuery } from "@tanstack/react-query";
import { useCanAccess } from "ra-core";
import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { crmApi } from "../api";
import { dashboardsKey } from "../dashboards/report";
import { groupable } from "../objects/choices";
import { useObject } from "../objects/model";
import { useViews } from "../objects/views";
import type { Dashboard } from "../types";
import { LeftRail } from "./LeftRail";
import {
  activeTab,
  AUTOMATION_TABS,
  HOME_TABS,
  objectTabs,
  reportTabs,
  sectionOf,
  SHOWN_VIEWS,
  settingsTabs,
  type Tab,
} from "./sections";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { TabStrip } from "./TabStrip";
import { TodayPanel } from "./TodayPanel";
import { useDueTasks } from "./today";
import { usePanel } from "./usePanel";

const SHOWN_REPORTS = 6;

/**
 * The CRM's desktop frame: a rail of places that are always there, a sidebar of record types and
 * views, tabs for the views of what's open, the page, a Today panel, and a status bar.
 */
export const CrmFrame = ({ children }: { children: ReactNode }) => {
  const { pathname, search } = useLocation();
  const section = sectionOf(pathname);
  const object = section.key === "object" ? section.object : undefined;
  const [sidebarOpen, toggleSidebar] = usePanel("crm.frame.sidebar", 1024);
  const [todayOpen, toggleToday] = usePanel("crm.frame.today", 1536);
  const { canAccess: isAdmin = false } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const { fields } = useObject(object);
  const { data: views = [] } = useViews(object ?? "");
  const { data: reports = [] } = useQuery({
    queryKey: dashboardsKey,
    queryFn: () => crmApi<Dashboard[]>("/dashboards"),
    enabled: section.key === "reports",
  });
  const { total: due = 0 } = useDueTasks();

  let tabs: Tab[] = HOME_TABS;
  let more: Tab[] = [];
  if (object) {
    const all = objectTabs(
      object,
      {
        board: fields.some(groupable),
        calendar: fields.some(
          (field) => field.type === "date" || field.type === "datetime",
        ),
      },
      views,
    );
    const shown = all.length - views.length + SHOWN_VIEWS;
    tabs = all.slice(0, shown);
    more = all.slice(shown);
  } else if (section.key === "reports") {
    const all = reportTabs(reports);
    tabs = all.slice(0, SHOWN_REPORTS);
    more = all.slice(SHOWN_REPORTS);
  } else if (section.key === "automations") {
    tabs = AUTOMATION_TABS;
  } else if (section.key === "settings") {
    tabs = settingsTabs(isAdmin);
  }
  const active = activeTab([...tabs, ...more], pathname, search);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        <LeftRail
          section={section}
          isAdmin={isAdmin}
          due={due}
          todayOpen={todayOpen}
          onToggleToday={toggleToday}
          onToggleSidebar={toggleSidebar}
        />
        {sidebarOpen ? (
          <Sidebar
            section={section}
            views={views}
            viewId={new URLSearchParams(search).get("view")}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <TabStrip tabs={tabs} more={more} active={active} />
          <main
            id="main-content"
            className="min-h-0 flex-1 overflow-y-auto px-6 py-4"
          >
            <div className="mx-auto max-w-screen-2xl">{children}</div>
          </main>
        </div>
        {todayOpen ? <TodayPanel /> : null}
      </div>
      <StatusBar />
    </div>
  );
};
