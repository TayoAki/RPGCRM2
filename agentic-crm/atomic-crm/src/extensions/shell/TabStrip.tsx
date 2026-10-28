import { ChevronDown } from "lucide-react";
import { Link } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { Tab } from "./sections";

type TabStripProps = {
  tabs: Tab[];
  more: Tab[];
  active: Tab | undefined;
};

/** The views of the part of the CRM that's open, as tabs; past a few, the rest are under More. */
export const TabStrip = ({ tabs, more, active }: TabStripProps) => {
  const activeInMore = more.some((tab) => tab.to === active?.to);
  if (tabs.length + more.length <= 1) return null;
  return (
    <nav
      aria-label="Views"
      className="flex shrink-0 items-end gap-1 border-b px-4 pt-2"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          aria-current={tab.to === active?.to ? "page" : undefined}
          className={cn(
            "max-w-48 truncate rounded-t-md border border-b-0 px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground",
            tab.to === active?.to
              ? "bg-background font-medium text-foreground"
              : "border-transparent",
          )}
        >
          {tab.label}
        </Link>
      ))}
      {more.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center gap-1 rounded-t-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
              activeInMore && "font-medium text-foreground",
            )}
          >
            {activeInMore ? active?.label : `${more.length} more`}
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {more.map((tab) => (
              <DropdownMenuItem key={tab.to} asChild>
                <Link to={tab.to}>{tab.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </nav>
  );
};
