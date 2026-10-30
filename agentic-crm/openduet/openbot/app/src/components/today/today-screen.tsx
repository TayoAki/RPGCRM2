import { IconFileText } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
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
import { LeadLists } from "./lead-lists";
import { StarterDialog, type StarterId } from "./starters";
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
import { EmptyDay, GetStarted, PutToWork, SetupReminder } from "./today-start";

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

const percent = (ratio: number) =>
  new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "always",
  }).format(ratio);

/**
 * The desktop's home. A new workspace gets its first steps and work a Bot can start on; numbers
 * and lists take over once there is something real to show.
 */
export function TodayScreen({ view }: { view: TodayView }) {
  usePageChrome({ title: "Today" });
  const now = new Date();
  const summary = useWorkspaceSummary(now);
  const { data: user } = useQuery(currentUserQueryOptions());
  const bot = primaryBot(useQuery(agentListQueryOptions()).data);
  const activity = useQuery(crmActivityQueryOptions());
  const sales = useQuery(crmSalesQueryOptions());
  const [starter, setStarter] = useState<StarterId | null>(null);
  const { tasks, inbox, deals, meetings } = summary.queries;
  const settled = [tasks, inbox, deals, meetings].every(
    (query) => !query.isPending,
  );
  const feed = (includeBots: boolean) =>
    activityFeed({
      summary,
      activity: activity.data?.data ?? [],
      sales: sales.data?.data ?? [],
      botName: bot?.name ?? "A Bot",
      includeBots,
    });
  const currency = summary.config?.currency;
  const botName = bot?.name ?? "your Bot";
  const fresh = settled && summary.empty;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-[var(--duet-head-space,92px)] pb-12">
      <div className="@container mx-auto flex w-full max-w-5xl flex-col gap-8">
        {settled && !fresh ? (
          <nav
            aria-label="Today"
            className="-mb-2 flex gap-1 border-duet-hair border-b"
          >
            {VIEWS.map((each) => (
              <Link
                aria-current={each.id === view ? "page" : undefined}
                className={cn(
                  "type-label -mb-px border-b-2 px-3 pb-2.5 text-duet-ink-2 hover:text-duet-ink",
                  each.id === view
                    ? "border-duet-accent font-medium text-duet-accent"
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
        ) : null}

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="type-display font-semibold text-duet-ink">
              {greeting(now.getHours())}
              {user ? `, ${firstName(user)}` : ""}.
            </h1>
            <p className="type-body mt-1 text-duet-ink-2">
              {fresh
                ? "Let's put your workspace to work."
                : `${now.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}. Here's what needs your attention.`}
            </p>
          </div>
          {fresh ? (
            <p className="type-caption text-duet-ink-2">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          ) : settled ? (
            <Link
              className="type-label inline-flex h-9 items-center gap-2 rounded-lg border border-duet-hair bg-duet-card px-3 font-medium text-duet-ink hover:bg-duet-tile"
              to="/"
            >
              <IconFileText size={16} stroke={1.75} />
              View brief
            </Link>
          ) : null}
        </header>

        {summary.setup.loaded && summary.setupDone < 3 ? (
          fresh ? (
            <GetStarted botName={botName} summary={summary} />
          ) : (
            <SetupReminder summary={summary} />
          )
        ) : null}

        {fresh ? (
          <>
            <PutToWork botName={botName} onStarter={setStarter} />
            <LeadLists />
            <EmptyDay />
          </>
        ) : null}

        {settled && !fresh && view === "overview" ? (
          <>
            <div className="grid gap-3 @2xl:grid-cols-3">
              <Stat
                label="Open pipeline"
                line={
                  summary.pipelineGrowth !== null
                    ? `${percent(summary.pipelineGrowth)} this month`
                    : `${summary.openDeals.length} open deals`
                }
                tone={summary.pipelineGrowth !== null ? "good" : undefined}
                value={money(summary.pipelineValue, currency)}
              />
              <Stat
                label="Follow-ups"
                line={
                  summary.followUpsLate.length
                    ? `${summary.followUpsLate.length} late`
                    : summary.followUpsDue.length
                      ? "Due today"
                      : "Nothing due"
                }
                tone={summary.followUpsLate.length ? "problem" : undefined}
                value={String(summary.followUpsDue.length)}
              />
              <Stat
                label="Bot work"
                line={`${summary.doneToday.length} done today`}
                value={`${summary.working.length} running`}
              />
            </div>
            <NeedsAttention now={now} summary={summary} />
            <LeadLists />
            <div className="grid gap-4 @3xl:grid-cols-2">
              <PipelineSnapshot summary={summary} />
              <UpcomingMeetings now={now} summary={summary} />
            </div>
            <RecentActivity entries={feed(true)} limit={4} />
          </>
        ) : null}

        {settled && !fresh && view === "mine" ? (
          <div className="grid gap-4 @3xl:grid-cols-2">
            <NeedsAttention limit={20} now={now} summary={summary} />
            <Card title="Your follow-ups due">
              {summary.followUpsDue.length ? (
                <ul className="flex flex-col gap-1">
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
                <ul className="flex flex-col gap-1">
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

        {settled && !fresh && view === "team" ? (
          <RecentActivity
            entries={feed(false)}
            limit={30}
            title="What the team added"
          />
        ) : null}
      </div>
      <StarterDialog onClose={() => setStarter(null)} starter={starter} />
    </div>
  );
}

function Stat({
  label,
  value,
  line,
  tone,
}: {
  label: string;
  value: string;
  line: ReactNode;
  tone?: "problem" | "good";
}) {
  return (
    <div className="rounded-2xl border border-duet-hair bg-duet-card px-5 py-4">
      <p className="type-label text-duet-ink-2">{label}</p>
      <p className="type-big mt-1 font-semibold text-duet-ink tabular-nums">
        {value}
      </p>
      <p
        className={cn(
          "type-caption mt-1",
          tone === "problem" && "text-duet-status-problem",
          tone === "good" && "text-duet-green",
          !tone && "text-duet-ink-2",
        )}
      >
        {line}
      </p>
    </div>
  );
}
