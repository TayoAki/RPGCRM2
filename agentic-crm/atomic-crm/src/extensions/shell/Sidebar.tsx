import {
  Boxes,
  Building2,
  CalendarDays,
  CircleCheck,
  FileText,
  Handshake,
  LayoutGrid,
  type LucideIcon,
  Table2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../../components/atomic-crm/root/ConfigurationContext";
import { useAccess, useMetadata } from "../objects/model";
import type { SavedView } from "../types";
import type { Section } from "./sections";

type Item = { key: string; label: string; to: string; icon: LucideIcon };

const RECORDS: Item[] = [
  { key: "contacts", label: "Contacts", to: "/contacts", icon: Users },
  { key: "companies", label: "Companies", to: "/companies", icon: Building2 },
  { key: "deals", label: "Deals", to: "/deals", icon: Handshake },
  { key: "meetings", label: "Meetings", to: "/meetings", icon: CalendarDays },
  { key: "tasks", label: "Tasks", to: "/o/tasks", icon: CircleCheck },
  { key: "proposals", label: "Proposals", to: "/o/proposals", icon: FileText },
];

const SidebarLink = ({ item, active }: { item: Item; active: boolean }) => (
  <Link
    to={item.to}
    aria-current={active ? "page" : undefined}
    className={cn(
      "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
      active && "bg-muted font-medium text-foreground",
    )}
  >
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background">
      <item.icon className="size-4" />
    </span>
    <span className="truncate">{item.label}</span>
  </Link>
);

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <h2 className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </h2>
    {children}
  </div>
);

type SidebarProps = {
  section: Section;
  views: SavedView[];
  viewId: string | null;
};

/** Every kind of record, the team's own included, and the saved views of the one open. */
export const Sidebar = ({ section, views, viewId }: SidebarProps) => {
  const { title, lightModeLogo, darkModeLogo } = useConfigurationContext();
  const { data } = useMetadata();
  const { data: access } = useAccess();
  const object = section.key === "object" ? section.object : null;
  const readable = (name: string) => access?.objects[name]?.read !== "none";
  const custom = (data?.objects ?? [])
    .filter(
      (each) =>
        !each.standard &&
        readable(each.name) &&
        (each.in_navigation || each.name === object),
    )
    .map((each) => ({
      key: each.name,
      label: each.label_plural,
      to: `/o/${each.name}`,
      icon: Boxes,
    }));
  const objectLabel =
    data?.objects.find((each) => each.name === object)?.label_plural ?? "";

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r bg-secondary/30 px-2 pb-3">
      <Link
        to="/"
        className="mt-2 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-semibold"
      >
        <img className="[.light_&]:hidden h-5" src={darkModeLogo} alt="" />
        <img className="[.dark_&]:hidden h-5" src={lightModeLogo} alt="" />
        <span className="truncate">{title}</span>
      </Link>
      <Group title="Records">
        {RECORDS.filter((item) => readable(item.key)).map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            active={object === item.key}
          />
        ))}
      </Group>
      {custom.length ? (
        <Group title="Your objects">
          {custom.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              active={object === item.key}
            />
          ))}
        </Group>
      ) : null}
      {object && views.length ? (
        <Group title={`${objectLabel} views`}>
          {views.map((view) => (
            <SidebarLink
              key={view.id}
              item={{
                key: String(view.id),
                label: view.name,
                to: `/o/${object}?view=${view.id}`,
                icon: view.type === "table" ? Table2 : LayoutGrid,
              }}
              active={viewId === String(view.id)}
            />
          ))}
        </Group>
      ) : null}
      <Group title="More">
        <SidebarLink
          item={{
            key: "all",
            label: "All records",
            to: "/o",
            icon: LayoutGrid,
          }}
          active={section.key === "records"}
        />
      </Group>
    </aside>
  );
};
