import { IconBriefcase, IconChartBar } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { startTaskMutationOptions } from "@/lib/tasks/mutations";
import {
  turnJobOffMutationOptions,
  turnJobOnMutationOptions,
  turnPlanOnMutationOptions,
} from "@/lib/work-plan/mutations";
import { type PlanJob, workPlanQueryOptions } from "@/lib/work-plan/queries";
import { queryClient } from "@/query-client";

const PRIMARY =
  "type-label inline-flex h-10 items-center rounded-xl bg-duet-accent px-4 font-semibold text-duet-on-accent transition-[filter] hover:brightness-110 disabled:opacity-60";
const SECONDARY =
  "type-label inline-flex h-10 items-center rounded-xl border border-duet-hair px-4 font-medium text-duet-ink transition-colors hover:bg-duet-tile disabled:opacity-60";

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function Job({
  job,
  busy,
  onToggle,
}: {
  job: PlanJob;
  busy: boolean;
  onToggle: (job: PlanJob) => void;
}) {
  return (
    <li className="flex items-start gap-3 border-t border-duet-hair py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="type-label font-medium text-duet-ink">{job.title}</p>
        <p className="type-caption mt-0.5 text-duet-ink-2">
          {job.schedule}. {job.why}
        </p>
      </div>
      <button
        aria-checked={job.on}
        aria-label={`${job.title}: ${job.on ? "on" : "off"}`}
        className={`type-caption inline-flex h-8 shrink-0 items-center rounded-full px-3 font-medium transition-colors disabled:opacity-60 ${
          job.on
            ? "bg-duet-accent text-duet-on-accent"
            : "border border-duet-hair text-duet-ink-2 hover:bg-duet-tile"
        }`}
        disabled={busy}
        onClick={() => onToggle(job)}
        role="switch"
        type="button"
      >
        {job.on ? "On" : "Off"}
      </button>
    </li>
  );
}

/** The company brief and the Bots' work plan: tell Magpie about the business, then switch its jobs on. */
export function WorkPlanCard() {
  const { data } = useQuery(workPlanQueryOptions());
  const navigate = useNavigate();
  const start = useMutation(startTaskMutationOptions(queryClient));
  const turnOn = useMutation(turnJobOnMutationOptions(queryClient));
  const turnOff = useMutation(turnJobOffMutationOptions(queryClient));
  const allOn = useMutation(turnPlanOnMutationOptions(queryClient));
  if (!data) return null;

  const ask = (instruction: string) =>
    start.mutate(
      { botId: data.botId, instruction },
      {
        onSuccess: (task) =>
          void navigate({ to: "/tasks/$taskId", params: { taskId: task.id } }),
      },
    );
  const busy =
    start.isPending || turnOn.isPending || turnOff.isPending || allOn.isPending;
  const error = start.error ?? turnOn.error ?? turnOff.error ?? allOn.error;
  const jobs = data.plan?.items ?? [];
  const onCount = jobs.filter((job) => job.on).length;

  const [title, line] = !data.brief
    ? [
        "Tell Magpie about your business",
        "A Bot reads what it can, asks you a few questions and writes a short brief every Bot works from. Then it plans the jobs to do each week.",
      ]
    : !data.plan
      ? [
          "Plan the Bots' work",
          "Your brief is saved. A Bot can now propose the jobs it should do each week, such as lead lists, follow-ups and a Friday pipeline review. You turn each one on.",
        ]
      : [
          "Your work plan",
          `${onCount} of ${plural(jobs.length, "job", "jobs")} on, about ${plural(data.runsPerMonthOn, "Bot run", "Bot runs")} a month. Each job runs as you and asks before it changes or sends anything.`,
        ];

  return (
    <section
      aria-labelledby="work-plan"
      className="rounded-2xl border border-duet-hair bg-duet-card p-5"
    >
      <div className="flex items-start gap-3">
        <IconBriefcase
          className="mt-0.5 shrink-0 text-duet-accent"
          size={22}
          stroke={1.75}
        />
        <div className="min-w-0 flex-1">
          <h2 className="type-label font-semibold text-duet-ink" id="work-plan">
            {title}
          </h2>
          <p className="type-caption mt-1 max-w-[62ch] text-duet-ink-2">
            {line}
          </p>
          {data.runsPerMonthOn > data.runsPerSeat * 0.75 ? (
            <p className="type-caption mt-1 text-duet-amber">
              That's most of the {data.runsPerSeat} runs a seat includes.
            </p>
          ) : null}
          {jobs.length ? (
            <ul className="mt-3">
              {jobs.map((job) => (
                <Job
                  busy={busy}
                  job={job}
                  key={job.id}
                  onToggle={(each) =>
                    each.on ? turnOff.mutate(each.id) : turnOn.mutate(each.id)
                  }
                />
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {!data.brief ? (
              <button
                className={PRIMARY}
                disabled={busy}
                onClick={() => ask(data.instructions.brief)}
                type="button"
              >
                {start.isPending ? "Starting…" : "Start"}
              </button>
            ) : (
              <>
                {!data.plan ? (
                  <button
                    className={PRIMARY}
                    disabled={busy}
                    onClick={() => ask(data.instructions.plan)}
                    type="button"
                  >
                    {start.isPending ? "Starting…" : "Make a plan"}
                  </button>
                ) : onCount < jobs.length ? (
                  <button
                    className={PRIMARY}
                    disabled={busy}
                    onClick={() => allOn.mutate()}
                    type="button"
                  >
                    Turn all on
                  </button>
                ) : null}
                {data.plan ? (
                  <button
                    className={SECONDARY}
                    disabled={busy}
                    onClick={() => ask(data.instructions.plan)}
                    type="button"
                  >
                    Change the plan
                  </button>
                ) : null}
                <button
                  className={SECONDARY}
                  disabled={busy}
                  onClick={() => ask(data.instructions.brief)}
                  type="button"
                >
                  Update the brief
                </button>
              </>
            )}
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

/** The last seven days: what the Bots ran, what came of it and what waits on you. */
export function WeekReportCard() {
  const { data } = useQuery(workPlanQueryOptions());
  if (!data || (!data.plan && data.week.botRuns.total === 0)) return null;
  const { botRuns, results, waiting } = data.week;
  const numbers = [
    [results.newContacts, "new contact", "new contacts"],
    [results.meetingsBooked, "meeting booked", "meetings booked"],
    [results.dealsMoved, "deal moved", "deals moved"],
    [results.dealsWon, "deal won", "deals won"],
    [results.replies, "reply", "replies"],
  ] as const;

  return (
    <section
      aria-labelledby="week-report"
      className="rounded-2xl border border-duet-hair bg-duet-card p-5"
    >
      <div className="flex items-start gap-3">
        <IconChartBar
          className="mt-0.5 shrink-0 text-duet-accent"
          size={22}
          stroke={1.75}
        />
        <div className="min-w-0 flex-1">
          <h2
            className="type-label font-semibold text-duet-ink"
            id="week-report"
          >
            Last 7 days
          </h2>
          <p className="type-caption mt-1 text-duet-ink-2">
            {botRuns.total
              ? `Bots ran ${plural(botRuns.total, "scheduled job", "scheduled jobs")}${
                  botRuns.failed ? `, and ${botRuns.failed} didn't finish` : ""
                }.`
              : "No scheduled jobs ran yet."}{" "}
            {waiting.drafts
              ? `${plural(waiting.drafts, "email draft is", "email drafts are")} waiting for you.`
              : null}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 @lg:grid-cols-5">
            {numbers.map(([count, one, many]) => (
              <div key={many}>
                <dt className="type-caption text-duet-ink-2">
                  {count === 1 ? one : many}
                </dt>
                <dd className="type-title font-semibold text-duet-ink">
                  {count}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
