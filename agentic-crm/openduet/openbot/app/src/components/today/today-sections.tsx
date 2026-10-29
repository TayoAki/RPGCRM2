import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { WorkspaceSummary } from "@/components/desktop/use-workspace-summary";
import { describeApproval } from "@/lib/approval-view";
import {
  type CrmActivity,
  type CrmConfig,
  type CrmSale,
  dealStages,
  stageLabel,
} from "@/lib/crm/queries";
import { agoShort } from "@/lib/relative-time";
import { TASK_STATUS_LABEL } from "@/lib/tasks/queries";
import { cn } from "@/lib/utils";

export function Card({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-duet-hair bg-duet-card p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="type-label font-semibold text-duet-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="type-caption py-4 text-center text-duet-ink-2">{children}</p>
  );
}

const ROW =
  "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-duet-tile";

export function money(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: amount >= 100_000 ? "compact" : "standard",
      maximumFractionDigits: amount >= 100_000 ? 1 : 0,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

const dueLine = (iso: string | null, now: Date) => {
  if (!iso) return "No due date";
  const due = new Date(iso);
  const days = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()) /
      86_400_000,
  );
  if (days <= 0) return "Due today";
  return days === 1 ? "1 day late" : `${days} days late`;
};

type AttentionItem = {
  key: string;
  title: string;
  line: string;
  tone: "needs" | "problem" | "done";
  link: ReactNode;
};

const ITEM_LINK =
  "type-caption shrink-0 rounded-lg border border-duet-hair px-2 py-1 font-medium text-duet-ink hover:bg-duet-tile";

/** Everything waiting on the person: approvals, a Bot's questions, finished work, late follow-ups. */
export function NeedsAttention({
  summary,
  now,
  limit = 6,
}: {
  summary: WorkspaceSummary;
  now: Date;
  limit?: number;
}) {
  const items: AttentionItem[] = [
    ...summary.approvals.map((request) => {
      const view = describeApproval(request);
      return {
        key: `approval-${request.id}`,
        title: view.title,
        line: view.app
          ? `Approval for ${view.app}`
          : "Waiting for your approval",
        tone: "needs" as const,
        link: (
          <Link className={ITEM_LINK} to="/tasks">
            Review
          </Link>
        ),
      };
    }),
    ...summary.questions.map((question) => ({
      key: `question-${question.id}`,
      title: question.question,
      line: "A Bot asked you",
      tone: "needs" as const,
      link: (
        <Link className={ITEM_LINK} to="/tasks">
          Answer
        </Link>
      ),
    })),
    ...summary.forReview.map((task) => ({
      key: `task-${task.id}`,
      title: task.title,
      line: TASK_STATUS_LABEL[task.status],
      tone:
        task.status === "needs_input" ? ("needs" as const) : ("done" as const),
      link: (
        <Link
          className={ITEM_LINK}
          params={{ taskId: task.id }}
          to="/tasks/$taskId"
        >
          Open
        </Link>
      ),
    })),
    ...summary.followUpsLate.map((task) => ({
      key: `follow-up-${task.id}`,
      title: task.text || "Follow-up",
      line: dueLine(task.due_date, now),
      tone: "problem" as const,
      link: (
        <Link
          className={ITEM_LINK}
          params={{ _splat: `contacts/${task.contact_id}/show` }}
          to="/crm/$"
        >
          Open
        </Link>
      ),
    })),
  ];
  return (
    <Card
      action={
        items.length > limit ? (
          <Link
            className="type-caption text-duet-ink-2 hover:text-duet-ink"
            to="/tasks"
          >
            See all {items.length}
          </Link>
        ) : null
      }
      title="Needs your attention"
    >
      {items.length ? (
        <ul className="-mx-2 flex flex-col">
          {items.slice(0, limit).map((item) => (
            <li className={ROW} key={item.key}>
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.tone === "needs" && "bg-duet-status-needs",
                  item.tone === "problem" && "bg-duet-status-problem",
                  item.tone === "done" && "bg-duet-status-done",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="type-label block truncate text-duet-ink">
                  {item.title}
                </span>
                <span className="type-caption block truncate text-duet-ink-2">
                  {item.line}
                </span>
              </span>
              {item.link}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>You're all caught up.</Empty>
      )}
    </Card>
  );
}

/** Open deals by stage, in the order the admin set the stages, one bar each sized by value. */
export function PipelineSnapshot({ summary }: { summary: WorkspaceSummary }) {
  const config: CrmConfig | undefined = summary.config;
  const byStage = new Map<string, { count: number; value: number }>();
  for (const deal of summary.openDeals) {
    const entry = byStage.get(deal.stage) ?? { count: 0, value: 0 };
    byStage.set(deal.stage, {
      count: entry.count + 1,
      value: entry.value + (deal.amount ?? 0),
    });
  }
  const order = dealStages(config).map((stage) => stage.value);
  const stages = [...byStage.entries()].sort(
    ([one], [other]) =>
      (order.indexOf(one) + 1 || order.length + 1) -
      (order.indexOf(other) + 1 || order.length + 1),
  );
  const largest = Math.max(1, ...stages.map(([, entry]) => entry.value));
  return (
    <Card
      action={
        <Link
          className="type-caption text-duet-ink-2 hover:text-duet-ink"
          params={{ _splat: "deals" }}
          to="/crm/$"
        >
          Open pipeline
        </Link>
      }
      title="Pipeline snapshot"
    >
      {stages.length ? (
        <ul className="flex flex-col gap-3">
          {stages.map(([stage, entry]) => (
            <li key={stage}>
              <div className="type-caption mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate font-medium text-duet-ink">
                  {stageLabel(stage, config)}
                </span>
                <span className="shrink-0 text-duet-ink-2 tabular-nums">
                  {entry.count} · {money(entry.value, config?.currency)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-duet-tile">
                <div
                  className="h-2 rounded-full bg-duet-accent"
                  style={{
                    width: `${Math.max(4, (entry.value / largest) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No open deals yet. Add one in Deals.</Empty>
      )}
    </Card>
  );
}

const meetingTime = (iso: string, now: Date) => {
  const at = new Date(iso);
  const time = at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const today = at.toDateString() === now.toDateString();
  const tomorrow =
    at.toDateString() === new Date(now.getTime() + 86_400_000).toDateString();
  if (today) return { day: "Today", time };
  if (tomorrow) return { day: "Tomorrow", time };
  return {
    day: at.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time,
  };
};

export function UpcomingMeetings({
  summary,
  now,
}: {
  summary: WorkspaceSummary;
  now: Date;
}) {
  return (
    <Card
      action={
        <Link
          className="type-caption text-duet-ink-2 hover:text-duet-ink"
          params={{ _splat: "meetings" }}
          to="/crm/$"
        >
          All meetings
        </Link>
      }
      title="Upcoming meetings"
    >
      {summary.meetings.length ? (
        <ul className="-mx-2 flex flex-col">
          {summary.meetings.map((meeting) => {
            const when = meetingTime(meeting.start_at, now);
            return (
              <li className={ROW} key={meeting.id}>
                <span className="w-20 shrink-0">
                  <span className="type-caption block text-duet-ink-2">
                    {when.day}
                  </span>
                  <span className="type-label block font-medium text-duet-ink tabular-nums">
                    {when.time}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="type-label block truncate text-duet-ink">
                    {meeting.title}
                  </span>
                  {meeting.location ? (
                    <span className="type-caption block truncate text-duet-ink-2">
                      {meeting.location}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No meetings coming up.</Empty>
      )}
    </Card>
  );
}

const ACTIVITY_VERB: Record<CrmActivity["type"], string> = {
  "company.created": "added the company",
  "contact.created": "added the contact",
  "contactNote.created": "wrote a note on a contact",
  "deal.created": "added the deal",
  "dealNote.created": "wrote a note on a deal",
};

function activityTarget(activity: CrmActivity) {
  if (activity.company) return activity.company.name;
  if (activity.contact) {
    return [activity.contact.first_name, activity.contact.last_name]
      .filter(Boolean)
      .join(" ");
  }
  if (activity.deal) return activity.deal.name;
  return activity.contact_note?.text ?? activity.deal_note?.text ?? "";
}

type FeedEntry = { key: string; who: string; what: string; at: string };

/** Bot work finished and records the team added, newest first. */
export function activityFeed(input: {
  summary: WorkspaceSummary;
  activity: CrmActivity[];
  sales: CrmSale[];
  botName: string;
  includeBots: boolean;
}): FeedEntry[] {
  const nameOf = (id: number | null) => {
    const sale = input.sales.find((each) => each.id === id);
    return sale
      ? [sale.first_name, sale.last_name].filter(Boolean).join(" ") || "Someone"
      : "Someone";
  };
  const crm = input.activity.flatMap((activity) =>
    activity.date
      ? [
          {
            key: activity.id,
            who: nameOf(activity.sales_id),
            what: `${ACTIVITY_VERB[activity.type]} ${activityTarget(activity)}`.trim(),
            at: activity.date,
          },
        ]
      : [],
  );
  const bots = input.includeBots
    ? input.summary.tasks
        .filter((task) => task.status === "resolved" && task.resolvedAt)
        .slice(0, 10)
        .map((task) => ({
          key: `task-${task.id}`,
          who: input.botName,
          what: `finished "${task.title}"`,
          at: task.resolvedAt as string,
        }))
    : [];
  return [...crm, ...bots].sort((one, other) => other.at.localeCompare(one.at));
}

export function RecentActivity({
  entries,
  limit = 6,
  title = "Recent activity",
}: {
  entries: FeedEntry[];
  limit?: number;
  title?: string;
}) {
  const now = Date.now();
  return (
    <Card title={title}>
      {entries.length ? (
        <ul className="flex flex-col gap-2.5">
          {entries.slice(0, limit).map((entry) => (
            <li className="flex items-start gap-2.5" key={entry.key}>
              <span className="type-caption mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-duet-tile font-semibold text-duet-ink">
                {entry.who.charAt(0).toUpperCase()}
              </span>
              <p className="type-label min-w-0 flex-1 text-duet-ink-2">
                <span className="font-medium text-duet-ink">{entry.who}</span>{" "}
                {entry.what}
              </p>
              <span className="type-caption shrink-0 text-duet-ink-3">
                {agoShort(entry.at, now)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Nothing yet. New records and finished Bot work show up here.
        </Empty>
      )}
    </Card>
  );
}
