import {
  IconArrowUpRight,
  IconSend,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { primaryBot } from "@/lib/agents/primary-bot";
import { agentListQueryOptions } from "@/lib/agents/queries";
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

/** Asks the panel offers, each a task the Bot starts on its own. */
export function suggestedSteps(summary: WorkspaceSummary): string[] {
  const steps: string[] = [];
  if (summary.followUpsLate.length) {
    steps.push("Draft emails for my overdue follow-ups");
  }
  const next = summary.meetings[0];
  if (next) steps.push(`Prepare me for "${next.title}"`);
  if (summary.openDeals.length) {
    steps.push("Which deals haven't moved in two weeks?");
  }
  steps.push("Summarize what changed in the CRM this week");
  return steps.slice(0, 3);
}

/** The assistant beside every page: what it is doing, what it suggests, and a box to ask it. */
export function AssistantPanel({
  summary,
  place,
  onClose,
}: {
  summary: WorkspaceSummary;
  place: string;
  onClose: () => void;
}) {
  const bot = primaryBot(useQuery(agentListQueryOptions()).data);
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
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ask.trim()) begin(ask.trim());
  };
  const name = bot?.name ?? "Assistant";
  return (
    <aside
      aria-label={name}
      className="flex w-80 shrink-0 flex-col border-duet-hair border-l bg-duet-card"
    >
      <header className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="grid size-8 place-items-center rounded-full bg-duet-violet-soft text-duet-violet">
          <IconSparkles size={18} stroke={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="type-label truncate font-semibold text-duet-ink">
            {name}
          </h2>
          <p className="type-caption truncate text-duet-ink-2">
            Looking at {place}
          </p>
        </div>
        <button
          aria-label="Hide the assistant"
          className="grid size-8 place-items-center rounded-lg text-duet-ink-2 hover:bg-duet-tile hover:text-duet-ink"
          onClick={onClose}
          type="button"
        >
          <IconX size={16} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="type-sub rounded-xl bg-duet-tile px-3 py-2.5 text-duet-ink">
          {daySummary(summary)}
        </p>

        <h3 className="type-caption mt-5 mb-2 font-medium text-duet-ink-3 uppercase tracking-wide">
          Suggested next steps
        </h3>
        <ul className="flex flex-col gap-1.5">
          {suggestedSteps(summary).map((step) => (
            <li key={step}>
              <button
                className="type-label flex w-full items-center gap-2 rounded-xl border border-duet-hair px-3 py-2 text-left text-duet-ink transition-colors hover:bg-duet-tile disabled:opacity-60"
                disabled={!bot || start.isPending}
                onClick={() => begin(step)}
                type="button"
              >
                <span className="min-w-0 flex-1">{step}</span>
                <IconArrowUpRight
                  className="shrink-0 text-duet-ink-3"
                  size={16}
                />
              </button>
            </li>
          ))}
        </ul>

        <h3 className="type-caption mt-5 mb-2 font-medium text-duet-ink-3 uppercase tracking-wide">
          Working in the background
        </h3>
        {summary.working.length ? (
          <ul className="flex flex-col gap-1">
            {summary.working.slice(0, 5).map((task) => (
              <li key={task.id}>
                <Link
                  className="flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-duet-tile"
                  params={{ taskId: task.id }}
                  to="/tasks/$taskId"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-duet-status-working"
                  />
                  <span className="min-w-0">
                    <span className="type-label block truncate text-duet-ink">
                      {task.title}
                    </span>
                    {task.next ? (
                      <span className="type-caption block truncate text-duet-ink-2">
                        {task.next}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-caption text-duet-ink-2">
            Nothing running. Ask below to start something.
          </p>
        )}
      </div>
      <form className="border-duet-hair border-t p-3" onSubmit={submit}>
        <div className="flex items-center gap-2 rounded-xl border border-duet-hair bg-duet-surface px-3 py-1.5 focus-within:ring-3 focus-within:ring-duet-accent/30">
          <input
            aria-label={`Ask ${name}`}
            className="type-label min-w-0 flex-1 bg-transparent py-1 text-duet-ink outline-none placeholder:text-duet-ink-3"
            disabled={!bot}
            onChange={(event) => setAsk(event.target.value)}
            placeholder={`Ask ${name} anything…`}
            value={ask}
          />
          <button
            aria-label="Send"
            className="grid size-7 place-items-center rounded-lg bg-duet-black text-duet-on-black disabled:opacity-40"
            disabled={!bot || !ask.trim() || start.isPending}
            type="submit"
          >
            <IconSend size={14} />
          </button>
        </div>
        {start.isError ? (
          <p className="type-caption mt-1.5 text-duet-red" role="alert">
            {start.error.message}
          </p>
        ) : (
          <p className="type-caption mt-1.5 text-duet-ink-3">
            Uses your CRM and connected apps.
          </p>
        )}
      </form>
    </aside>
  );
}
