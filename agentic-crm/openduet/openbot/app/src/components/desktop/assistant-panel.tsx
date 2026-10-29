import {
  IconArrowUp,
  IconCalendarEvent,
  IconChartBar,
  IconChevronRight,
  IconFileText,
  IconInbox,
  IconLayoutSidebarRightCollapse,
  IconSparkles,
  type TablerIcon,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, type RefObject, useState } from "react";
import { STARTERS, type StarterId } from "@/components/today/starters";
import { primaryBot } from "@/lib/agents/primary-bot";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { startTaskMutationOptions } from "@/lib/tasks/mutations";
import { queryClient } from "@/query-client";
import type { WorkspaceSummary } from "./use-workspace-summary";

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** One sentence on the day so far, from the same counts the Today page shows. */
export function daySummary(summary: WorkspaceSummary): string {
  const parts: string[] = [];
  if (summary.waiting) {
    parts.push(`${plural(summary.waiting, "thing", "things")} waiting on you`);
  }
  if (summary.followUpsDue.length) {
    parts.push(
      plural(summary.followUpsDue.length, "follow-up due", "follow-ups due"),
    );
  }
  if (summary.meetingsToday.length) {
    parts.push(
      plural(summary.meetingsToday.length, "meeting today", "meetings today"),
    );
  }
  if (!parts.length) return "Nothing needs you right now.";
  const last = parts.pop();
  const sentence = parts.length ? `${parts.join(", ")} and ${last}` : last;
  return `You have ${sentence}.`;
}

type Step = { label: string; icon: TablerIcon; ask: string };

/** Asks that fit what's in the workspace today, each a task the Bot starts on its own. */
export function suggestedSteps(summary: WorkspaceSummary): Step[] {
  const steps: Step[] = [];
  const next = summary.meetings[0];
  if (next) {
    steps.push({
      label: "Prepare for my next meeting",
      icon: IconCalendarEvent,
      ask: `Prepare me for "${next.title}": who's coming, what we last discussed, and what I should get out of it.`,
    });
  }
  if (summary.openDeals.length) {
    steps.push({
      label: "Show deals at risk",
      icon: IconChartBar,
      ask: "Which open deals are at risk? Look for deals that haven't moved in two weeks, have no next step, or are past their expected close date.",
    });
  }
  if (summary.followUpsDue.length) {
    steps.push({
      label: "Draft today's follow-ups",
      icon: IconFileText,
      ask: "Draft emails for the follow-ups due today and the late ones, one per contact, for me to review.",
    });
  }
  if (steps.length < 3) {
    steps.push({
      label: "Summarize this week",
      icon: IconSparkles,
      ask: "Summarize what changed in the CRM this week: new contacts, deals that moved, and anything I should act on.",
    });
  }
  return steps.slice(0, 3);
}

const GETTING_STARTED: StarterId[] = ["import", "pipeline", "notes"];

const ROW =
  "type-label flex w-full items-center gap-3 px-3 py-2.5 text-left text-duet-ink transition-colors hover:bg-duet-tile disabled:opacity-60";

const SECTION = "type-caption mt-6 mb-2 font-medium text-duet-ink-3";

/** The assistant beside every page: setup help in a new workspace, the day's work after that. */
export function AssistantPanel({
  summary,
  place,
  onClose,
  onStarter,
  askRef,
}: {
  summary: WorkspaceSummary;
  place: string;
  onClose: () => void;
  onStarter: (starter: StarterId) => void;
  askRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const bot = primaryBot(useQuery(agentListQueryOptions()).data);
  const { data: user } = useQuery(currentUserQueryOptions());
  const navigate = useNavigate();
  const start = useMutation(startTaskMutationOptions(queryClient));
  const [ask, setAsk] = useState("");
  const begin = (instruction: string) => {
    if (!bot || start.isPending) return;
    start.mutate(
      { botId: bot.id, instruction },
      {
        onSuccess: (task) => {
          setAsk("");
          void navigate({ to: "/tasks/$taskId", params: { taskId: task.id } });
        },
      },
    );
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (ask.trim()) begin(ask.trim());
  };
  const name = bot?.name ?? "Assistant";
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const gettingStarted = summary.empty && summary.setupDone < 3;
  return (
    <aside
      aria-label={name}
      className="flex w-80 shrink-0 flex-col border-duet-hair border-l bg-duet-card"
    >
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <IconSparkles className="shrink-0 text-duet-accent" size={22} />
        <div className="min-w-0 flex-1">
          <h2 className="type-label truncate font-semibold text-duet-ink">
            {name}
          </h2>
          <p className="type-caption truncate text-duet-ink-2">
            Workspace assistant
          </p>
        </div>
        <button
          aria-label="Hide the assistant"
          className="grid size-8 place-items-center rounded-lg text-duet-ink-2 hover:bg-duet-tile hover:text-duet-ink"
          onClick={onClose}
          type="button"
        >
          <IconLayoutSidebarRightCollapse size={18} stroke={1.75} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="type-caption inline-flex rounded-full bg-duet-accent-soft px-2.5 py-1 font-medium text-duet-accent">
          {gettingStarted ? "Getting started" : `${place} · Workspace`}
        </p>
        {gettingStarted ? (
          <>
            <p className="type-sub mt-3 text-duet-ink">
              {firstName ? `Hi ${firstName}. ` : ""}Let's start with your
              contacts. Import a list or connect an app, and I can help plan
              your next steps.
            </p>
            <h3 className={SECTION}>I can help you</h3>
            <ul className="divide-y divide-duet-hair overflow-hidden rounded-xl border border-duet-hair">
              {GETTING_STARTED.map((id) => {
                const Icon = STARTERS[id].icon;
                return (
                  <li key={id}>
                    <button
                      className={ROW}
                      onClick={() => onStarter(id)}
                      type="button"
                    >
                      <Icon
                        className="shrink-0 text-duet-ink-2"
                        size={18}
                        stroke={1.75}
                      />
                      <span className="min-w-0 flex-1">{STARTER_ASK[id]}</span>
                      <IconChevronRight
                        className="shrink-0 text-duet-ink-3"
                        size={16}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <p className="type-sub mt-3 text-duet-ink">{daySummary(summary)}</p>
            <h3 className={SECTION}>Suggested next steps</h3>
            <ul className="divide-y divide-duet-hair overflow-hidden rounded-xl border border-duet-hair">
              {suggestedSteps(summary).map((step) => (
                <li key={step.label}>
                  <button
                    className={ROW}
                    disabled={!bot || start.isPending}
                    onClick={() => begin(step.ask)}
                    type="button"
                  >
                    <step.icon
                      className="shrink-0 text-duet-ink-2"
                      size={18}
                      stroke={1.75}
                    />
                    <span className="min-w-0 flex-1">{step.label}</span>
                    <IconChevronRight
                      className="shrink-0 text-duet-ink-3"
                      size={16}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {summary.working.length ? (
          <>
            <h3 className={SECTION}>Working in the background</h3>
            <ul className="flex flex-col gap-1">
              {summary.working.slice(0, 5).map((task) => (
                <li key={task.id}>
                  <Link
                    className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-duet-tile"
                    params={{ taskId: task.id }}
                    to="/tasks/$taskId"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-duet-status-working motion-safe:animate-pulse"
                    />
                    <span className="min-w-0">
                      <span className="type-label block truncate text-duet-ink">
                        {task.title}
                      </span>
                      <span className="type-caption block truncate text-duet-ink-2">
                        {task.next || "In progress"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Link
            className="mt-6 flex items-start gap-3 rounded-xl bg-duet-tile px-3 py-3 hover:bg-duet-hair"
            to="/tasks"
          >
            <IconInbox
              className="mt-0.5 shrink-0 text-duet-ink-2"
              size={18}
              stroke={1.75}
            />
            <span>
              <span className="type-label block font-medium text-duet-ink">
                Track Bot work in Inbox
              </span>
              <span className="type-caption block text-duet-ink-2">
                Progress, questions and approvals together.
              </span>
            </span>
          </Link>
        )}
      </div>
      <form className="p-3" onSubmit={submit}>
        <div className="rounded-2xl border border-duet-hair bg-duet-surface p-2.5 focus-within:border-duet-accent/50 focus-within:ring-3 focus-within:ring-duet-accent/20">
          <textarea
            aria-label={`Ask ${name}`}
            className="type-label block max-h-32 min-h-10 w-full resize-none bg-transparent px-1 text-duet-ink outline-none placeholder:text-duet-ink-3"
            disabled={!bot}
            onChange={(event) => setAsk(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={`Ask ${name} anything…`}
            ref={askRef}
            rows={2}
            value={ask}
          />
          <div className="mt-1 flex items-center gap-2">
            <span className="type-caption min-w-0 flex-1 truncate px-1 text-duet-ink-3">
              {place} · Your workspace
            </span>
            <button
              aria-label="Send"
              className="grid size-8 place-items-center rounded-full bg-duet-accent text-duet-on-accent transition-opacity disabled:opacity-40"
              disabled={!bot || !ask.trim() || start.isPending}
              type="submit"
            >
              <IconArrowUp size={16} stroke={2} />
            </button>
          </div>
        </div>
        {start.isError ? (
          <p className="type-caption mt-1.5 px-1 text-duet-red" role="alert">
            {start.error.message}
          </p>
        ) : (
          <p className="type-caption mt-1.5 px-1 text-duet-ink-3">
            Uses your CRM and connected apps.
          </p>
        )}
      </form>
    </aside>
  );
}

const STARTER_ASK: Record<StarterId, string> = {
  import: "Help me import my contacts",
  pipeline: "Plan my sales stages",
  notes: "Turn notes into follow-ups",
  intro: "Draft a warm introduction",
};
