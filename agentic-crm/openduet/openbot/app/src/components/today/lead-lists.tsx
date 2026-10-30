import { IconTargetArrow } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  startWeeklyLeadsMutationOptions,
  stopWeeklyLeadsMutationOptions,
} from "@/lib/prospecting/mutations";
import { leadsPath, prospectingQueryOptions } from "@/lib/prospecting/queries";
import { startTaskMutationOptions } from "@/lib/tasks/mutations";
import { queryClient } from "@/query-client";

const PRIMARY =
  "type-label inline-flex h-10 items-center rounded-xl bg-duet-accent px-4 font-semibold text-duet-on-accent transition-[filter] hover:brightness-110 disabled:opacity-60";
const SECONDARY =
  "type-label inline-flex h-10 items-center rounded-xl border border-duet-hair px-4 font-medium text-duet-ink transition-colors hover:bg-duet-tile disabled:opacity-60";

const money = (usd: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(usd);

const nextRun = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Weekly warm leads: people engaging with niche posts, verified, scored and drafted to, approved before anything is added or sent. */
export function LeadLists() {
  const { data } = useQuery(prospectingQueryOptions());
  const navigate = useNavigate();
  const findNow = useMutation(startTaskMutationOptions(queryClient));
  const turnOn = useMutation(startWeeklyLeadsMutationOptions(queryClient));
  const turnOff = useMutation(stopWeeklyLeadsMutationOptions(queryClient));
  if (!data?.available) return null;

  const error = findNow.error ?? turnOn.error ?? turnOff.error;
  const busy = findNow.isPending || turnOn.isPending || turnOff.isPending;
  const runNow = () =>
    findNow.mutate(
      { botId: data.botId, instruction: data.instruction },
      {
        onSuccess: (task) =>
          void navigate({ to: "/tasks/$taskId", params: { taskId: task.id } }),
      },
    );

  return (
    <section
      aria-labelledby="lead-lists"
      className="rounded-2xl border border-duet-hair bg-duet-card p-5"
    >
      <div className="flex items-start gap-3">
        <IconTargetArrow
          className="mt-0.5 shrink-0 text-duet-accent"
          size={22}
          stroke={1.75}
        />
        <div className="min-w-0 flex-1">
          <h2
            className="type-label font-semibold text-duet-ink"
            id="lead-lists"
          >
            {data.routine ? "Weekly lead list" : "Find warm leads on LinkedIn"}
          </h2>
          {data.routine ? (
            <p className="type-caption mt-1 text-duet-ink-2">
              On. Next list {nextRun(data.routine.nextRunAt)}.{" "}
              {data.leadsThisWeek === 1
                ? "1 new lead this week."
                : `${data.leadsThisWeek} new leads this week.`}{" "}
              {data.draftsWaiting
                ? data.draftsWaiting === 1
                  ? "1 email drafted for you to review. "
                  : `${data.draftsWaiting} emails drafted for you to review. `
                : null}
              {money(data.budget.spentUsd)} of {money(data.budget.monthlyUsd)}{" "}
              used this month.
            </p>
          ) : (
            <p className="type-caption mt-1 max-w-[60ch] text-duet-ink-2">
              Every Monday, a Bot finds people engaging with posts your buyers
              care about, verifies their work emails, ranks them A to D against
              your best customers and drafts a personal email to the best ones.
              You approve the list and every send.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {data.routine ? (
              <a
                className={SECONDARY}
                href={`/crm/${leadsPath(data.leadSource)}`}
              >
                View leads
              </a>
            ) : (
              <button
                className={PRIMARY}
                disabled={busy}
                onClick={() => turnOn.mutate()}
                type="button"
              >
                Turn on weekly lead list
              </button>
            )}
            <button
              className={SECONDARY}
              disabled={busy}
              onClick={runNow}
              type="button"
            >
              {findNow.isPending ? "Starting…" : "Find leads now"}
            </button>
            {data.routine ? (
              <button
                className="type-label inline-flex h-10 items-center rounded-xl px-3 text-duet-ink-2 hover:text-duet-ink disabled:opacity-60"
                disabled={busy}
                onClick={() => turnOff.mutate()}
                type="button"
              >
                Turn off
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="type-caption mt-2 text-duet-red" role="alert">
              {error.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
