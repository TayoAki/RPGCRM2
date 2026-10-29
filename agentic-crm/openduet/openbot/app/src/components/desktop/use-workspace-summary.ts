import { useQuery } from "@tanstack/react-query";
import { approvalInboxOptions, waitingOnYou } from "@/lib/approvals";
import {
  closedStages,
  crmConfigurationQueryOptions,
  crmContactCountQueryOptions,
  crmDealsQueryOptions,
  crmFollowUpsQueryOptions,
  crmMeetingsQueryOptions,
  crmMeQueryOptions,
} from "@/lib/crm/queries";
import {
  connectionsQueryOptions,
  personalConnections,
} from "@/lib/plugins/queries";
import { needsInputCount } from "@/lib/tasks/groups";
import { taskListQueryOptions } from "@/lib/tasks/queries";

const sameDay = (iso: string | null, day: Date) => {
  if (!iso) return false;
  const at = new Date(iso);
  return (
    at.getFullYear() === day.getFullYear() &&
    at.getMonth() === day.getMonth() &&
    at.getDate() === day.getDate()
  );
};

/** What the desktop shell counts in its rail, panel, status bar and Today page, from one set of reads. */
export function useWorkspaceSummary(now: Date = new Date()) {
  const tasks = useQuery(taskListQueryOptions());
  const inbox = useQuery(approvalInboxOptions());
  const me = useQuery(crmMeQueryOptions());
  const followUps = useQuery(crmFollowUpsQueryOptions(me.data?.id));
  const meetings = useQuery(crmMeetingsQueryOptions());
  const deals = useQuery(crmDealsQueryOptions());
  const configuration = useQuery(crmConfigurationQueryOptions());
  const contactCount = useQuery(crmContactCountQueryOptions());
  const connections = useQuery(connectionsQueryOptions());

  const allTasks = tasks.data ?? [];
  const working = allTasks.filter((task) => task.status === "working");
  const forReview = allTasks.filter(
    (task) =>
      task.status === "ready_for_review" || task.status === "needs_input",
  );
  const doneToday = allTasks.filter(
    (task) => task.status === "resolved" && sameDay(task.resolvedAt, now),
  );
  const closed = closedStages(configuration.data);
  const openDeals = (deals.data?.data ?? []).filter(
    (deal) => !closed.includes(deal.stage),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = openDeals.filter(
    (deal) => new Date(deal.created_at) >= startOfMonth,
  );
  const due = followUps.data?.data ?? [];
  const meetingsToday = (meetings.data?.data ?? []).filter((meeting) =>
    sameDay(meeting.start_at, now),
  );
  const openValue = openDeals.reduce(
    (sum, deal) => sum + (deal.amount ?? 0),
    0,
  );
  const addedThisMonth = newThisMonth.reduce(
    (sum, deal) => sum + (deal.amount ?? 0),
    0,
  );
  const appsConnected = personalConnections(
    connections.data?.connections ?? [],
  ).filter((connection) => !connection.revoked).length;
  const setup = {
    loaded: connections.isSuccess && contactCount.isSuccess && deals.isSuccess,
    appConnected: appsConnected > 0,
    hasContacts: (contactCount.data ?? 0) > 0,
    hasDeal: (deals.data?.total ?? 0) > 0,
  };

  return {
    queries: { tasks, inbox, followUps, meetings, deals, configuration },
    config: configuration.data,
    tasks: allTasks,
    working,
    forReview,
    doneToday,
    waiting: needsInputCount(tasks.data, inbox.data),
    approvals: waitingOnYou(inbox.data).requests,
    questions: waitingOnYou(inbox.data).questions,
    openDeals,
    pipelineValue: openValue,
    // Growth of the open pipeline from deals added this month, or null with nothing to compare to.
    pipelineGrowth:
      openValue > addedThisMonth && addedThisMonth > 0
        ? addedThisMonth / (openValue - addedThisMonth)
        : null,
    newThisMonth,
    appsConnected,
    setup,
    setupDone: [setup.appConnected, setup.hasContacts, setup.hasDeal].filter(
      Boolean,
    ).length,
    followUpsDue: due,
    followUpsLate: due.filter(
      (task) => task.due_date && new Date(task.due_date) < startOfDay(now),
    ),
    meetings: meetings.data?.data ?? [],
    meetingsToday,
    syncedAt: Math.max(tasks.dataUpdatedAt, inbox.dataUpdatedAt),
    syncFailed: tasks.isError || inbox.isError,
    // Nothing yet to show as numbers: no deals, meetings, follow-ups or Bot work.
    empty:
      !openDeals.length &&
      !due.length &&
      !(meetings.data?.data ?? []).length &&
      !allTasks.length &&
      !waitingOnYou(inbox.data).count,
  };
}

function startOfDay(day: Date) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

export type WorkspaceSummary = ReturnType<typeof useWorkspaceSummary>;
