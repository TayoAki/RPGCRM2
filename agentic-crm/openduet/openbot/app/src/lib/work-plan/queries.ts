import { queryOptions } from "@tanstack/react-query";
import { client } from "@/lib/client";

export type PlanJob = {
  id: string;
  title: string;
  why: string;
  schedule: string;
  runsPerMonth: number;
  on: boolean;
  nextRunAt: string | null;
  lastRun: { status: string | null; finishedAt: string | null } | null;
};

export type WeekReport = {
  since: string;
  botRuns: {
    total: number;
    succeeded: number;
    failed: number;
    waiting: number;
  };
  results: {
    newContacts: number;
    meetingsBooked: number;
    dealsMoved: number;
    dealsWon: number;
    replies: number;
  };
  waiting: { drafts: number };
};

export type WorkPlan = {
  botId: string;
  brief: { updatedAt: string; preview: string } | null;
  plan: { savedAt: string; items: PlanJob[] } | null;
  runsPerMonthOn: number;
  runsPerSeat: number;
  instructions: { brief: string; plan: string };
  week: WeekReport;
};

export const workPlanKeys = { all: ["work-plan"] as const };

export const workPlanQueryOptions = () =>
  queryOptions({
    queryKey: workPlanKeys.all,
    queryFn: () =>
      client<WorkPlan>("/api/work-plan", "data", {
        fallback: "Couldn't load the work plan.",
      }),
    staleTime: 60_000,
  });
