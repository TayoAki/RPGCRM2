import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";

export type Prospecting = {
  available: boolean;
  botId: string;
  instruction: string;
  leadSource: string;
  profile: string | null;
  leadsThisWeek: number;
  draftsWaiting: number;
  budget: { monthlyUsd: number; spentUsd: number };
  routine: {
    id: string;
    schedule: string;
    enabled: boolean;
    nextRunAt: string;
  } | null;
};

export const prospectingKeys = { all: ["prospecting"] as const };

export const prospectingQueryOptions = () =>
  queryOptions({
    queryKey: prospectingKeys.all,
    queryFn: () =>
      client<Prospecting>("/api/prospecting", "data", {
        fallback: "Couldn't load lead lists.",
      }),
    staleTime: 60_000,
  });

/** The CRM's contact list, showing the leads prospecting added. */
export const leadsPath = (leadSource: string) =>
  `contacts?filter=${encodeURIComponent(JSON.stringify({ lead_source: leadSource }))}`;
