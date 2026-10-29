import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useWorkspaceSummary } from "@/components/desktop/use-workspace-summary";
import { usePageChrome } from "@/components/shell/page-chrome";
import { primaryBot } from "@/lib/agents/primary-bot";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import {
  crmActivityQueryOptions,
  crmSalesQueryOptions,
} from "@/lib/crm/queries";
import { cn } from "@/lib/utils";
import {
  activityFeed,
  Card,
  Empty,
  money,
  NeedsAttention,
  PipelineSnapshot,
  RecentActivity,
  UpcomingMeetings,
} from "./today-sections";

export type TodayView = "overview" | "mine" | "team";

const VIEWS: { id: TodayView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "mine", label: "My work" },
  { id: "team", label: "Team activity" },
];

export function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(user: { name?: string | null; email: string }) {
  const name = user.name?.trim().split(/\s+/)[0];
  return name || user.email.split("@")[0];
}

/** The desktop's home: what changed, what needs the person, and the pipeline at a glance. */
export function TodayScreen({ view }: { view: TodayView }) {
  usePageChrome({ title: "Today" });
  const now = new Date();
  const summary = useWorkspaceSummary(now);
  const { data: user } = useQuery(currentUserQueryOptions());
  const bot = primaryBot(useQuery(agentListQueryOptions()).data);
  const activity = useQuery(crmActivityQueryOptions());
  const sales = useQuery(crmSalesQueryOptions());
  const feed = (includeBots: boolean) =>
    activityFeed({
      summary,
      activity: activity.data?.data ?? [],
      sales: sales.data?.data ?? [],
      botName: bot?.name ?? "A Bot",
      includeBots,
    });
  const currency = summary.config?.currency;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-[var(--duet-head-space,92px)] pb-10">
      <div className="@container mx-auto flex w-full max-w-6xl flex-col gap-5">
        <nav
          aria-label="Today"
          className="flex gap-1 border-duet-hair border-b"
        >
          {VIEWS.map((each) => (
            <Link
              aria-current={each.id === view ? "page" : undefined}
              className={cn(
                "type-label -mb-px border-b-2 px-3 pb-2 text-duet-ink-2 hover:text-duet-ink",
                each.id === view
                  ? "border-duet-ink font-medium text-duet-ink"
                  : "border-transparent",
              )}
              key={each.id}
              search={each.id === "overview" ? {} : { view: each.id }}
              to="/today"
            >
              {each.label}
            </Link>
          ))}
        </nav>

        <header>
          <h1 className="type-display font-semibold text-duet-ink">
            {greeting(now.getHours())}
            {user ? `, ${firstName(user)}` : ""}.
          </h1>
          <p className="type-sub mt-1 text-duet-ink-2">
            {now.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </header>

        {view === "overview" ? (
          <>
            <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
              <Stat
                label="Open pipeline"
                line={`${summary.openDeals.length} deals, ${summary.newThisMonth.length} new this month`}
                value={money(summary.pipelineValue, currency)}
              />
              <Stat
                label="Follow-ups due"
                line={
                  summary.followUpsLate.length
                    ? `${summary.followUpsLate.length} late`
                    : "None late"
                }
                tone={summary.followUpsLate.length ? "problem" : undefined}
                value={String(summary.followUpsDue.length)}
              />
              <Stat
                label="Meetings today"
                line={
                  summary.meetings[0]
                    ? `Next: ${summary.meetings[0].title}`
                    : "Nothing booked"
                }
                value={String(summary.meetingsToday.length)}
              />
              <Stat
                label="Bot work"
                line={`${summary.working.length} running, ${summary.doneToday.length} done today`}
                value={String(summary.waiting)}
                valueLine="waiting on you"
              />
            </div>
            <div className="grid gap-4 @3xl:grid-cols-[3fr_2fr]">
              <NeedsAttention now={now} summary={summary} />
              <PipelineSnapshot summary={summary} />
            </div>
            <div className="grid gap-4 @3xl:grid-cols-2">
              <UpcomingMeetings now={now} summary={summary} />
              <RecentActivity entries={feed(true)} />
            </div>
          </>
        ) : null}

        {view === "mine" ? (
          <div className="grid gap-4 @3xl:grid-cols-2">
            <NeedsAttention limit={20} now={now} summary={summary} />
            <Card title="Your follow-ups due">
              {summary.followUpsDue.length ? (
                <ul className="flex flex-col gap-2">
                  {summary.followUpsDue.map((task) => (
                    <li key={task.id}>
                      <Link
                        className="type-label block truncate rounded-lg px-2 py-1.5 text-duet-ink hover:bg-duet-tile"
                        params={{ _splat: `contacts/${task.contact_id}/show` }}
                        to="/crm/$"
                      >
                        {task.text || "Follow-up"}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No follow-ups due today.</Empty>
              )}
            </Card>
            <UpcomingMeetings now={now} summary={summary} />
            <Card title="Bot work in progress">
              {summary.working.length ? (
                <ul className="flex flex-col gap-2">
                  {summary.working.map((task) => (
                    <li key={task.id}>
                      <Link
                        className="type-label block truncate rounded-lg px-2 py-1.5 text-duet-ink hover:bg-duet-tile"
                        params={{ taskId: task.id }}
                        to="/tasks/$taskId"
                      >
                        {task.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No Bot is working on anything for you.</Empty>
              )}
            </Card>
          </div>
        ) : null}

        {view === "team" ? (
          <RecentActivity
            entries={feed(false)}
            limit={30}
            title="What the team added"
          />
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  valueLine,
  line,
  tone,
}: {
  label: string;
  value: string;
  valueLine?: string;
  line: ReactNode;
  tone?: "problem";
}) {
  return (
    <div className="rounded-2xl border border-duet-hair bg-duet-card p-4">
      <p className="type-caption font-medium text-duet-ink-2">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="type-big font-semibold text-duet-ink tabular-nums">
          {value}
        </span>
        {valueLine ? (
          <span className="type-caption text-duet-ink-2">{valueLine}</span>
        ) : null}
      </p>
      <p
        className={cn(
          "type-caption mt-1",
          tone === "problem" ? "text-duet-status-problem" : "text-duet-ink-2",
        )}
      >
        {line}
      </p>
    </div>
  );
}
