import {
  IconArrowRight,
  IconCalendarCheck,
  IconCheck,
  IconChevronRight,
} from "@tabler/icons-react";
import { Link, type LinkProps } from "@tanstack/react-router";
import type { WorkspaceSummary } from "@/components/desktop/use-workspace-summary";
import { cn } from "@/lib/utils";
import { STARTERS, type StarterId } from "./starters";

type SetupStep = {
  title: string;
  line: string;
  action: string;
  done: boolean;
  link: LinkProps;
};

export function setupSteps(summary: WorkspaceSummary): SetupStep[] {
  return [
    {
      title: "Connect an app",
      line: "Email, calendar, or another tool",
      action: "Connect an app",
      done: summary.setup.appConnected,
      link: { to: "/connections" },
    },
    {
      title: "Bring in your contacts",
      line: "Import a CSV or add people by hand",
      action: "Import contacts",
      done: summary.setup.hasContacts,
      link: { to: "/crm/$", params: { _splat: "contacts" } },
    },
    {
      title: "Create your first deal",
      line: "Set a value and a next step",
      action: "Create a deal",
      done: summary.setup.hasDeal,
      link: { to: "/crm/$", params: { _splat: "deals/create" } },
    },
  ];
}

/** The three things that make a new workspace useful, with the next one as the one clear action. */
export function GetStarted({
  summary,
  botName,
}: {
  summary: WorkspaceSummary;
  botName: string;
}) {
  const steps = setupSteps(summary);
  const left = steps.filter((step) => !step.done);
  const [primary, secondary] = left;
  return (
    <section
      aria-labelledby="get-started"
      className="grid gap-8 rounded-2xl bg-duet-accent-soft/60 p-8 @3xl:grid-cols-[1.1fr_1fr]"
    >
      <div className="flex flex-col justify-center">
        <h2
          className="type-display max-w-[16ch] text-balance font-semibold text-duet-ink"
          id="get-started"
        >
          Start with the people you already know.
        </h2>
        <p className="type-body mt-3 max-w-[48ch] text-duet-ink-2">
          Connect an app or import a contact list. {botName} can help you
          organize the next steps.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {primary ? (
            <Link
              {...primary.link}
              className="type-label inline-flex h-11 items-center gap-2 rounded-xl bg-duet-accent px-5 font-semibold text-duet-on-accent transition-[filter] hover:brightness-110"
            >
              {primary.action}
              <IconArrowRight size={16} stroke={2} />
            </Link>
          ) : null}
          {secondary ? (
            <Link
              {...secondary.link}
              className="type-label inline-flex h-11 items-center rounded-xl border border-duet-accent/40 px-5 font-semibold text-duet-accent transition-colors hover:bg-duet-card"
            >
              {secondary.action}
            </Link>
          ) : null}
        </div>
      </div>
      <div>
        <p className="type-caption mb-2 font-medium text-duet-ink-2">
          {steps.length - left.length} of {steps.length} done
        </p>
        <ol className="divide-y divide-duet-hair">
          {steps.map((step, index) => (
            <li key={step.title}>
              <Link
                {...step.link}
                className="group flex items-center gap-4 py-4"
              >
                <span
                  className={cn(
                    "type-label grid size-9 shrink-0 place-items-center rounded-full border font-semibold tabular-nums",
                    step.done
                      ? "border-duet-green bg-duet-green text-white"
                      : "border-duet-accent/40 bg-duet-card text-duet-accent",
                  )}
                >
                  {step.done ? <IconCheck size={16} stroke={2.5} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "type-label block font-semibold",
                      step.done
                        ? "text-duet-ink-2 line-through"
                        : "text-duet-ink",
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="type-caption block text-duet-ink-2">
                    {step.line}
                  </span>
                </span>
                <IconChevronRight
                  className="shrink-0 text-duet-ink-3 transition-transform group-hover:translate-x-0.5"
                  size={18}
                />
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** What's left of setup, in one line, once the workspace has real work in it. */
export function SetupReminder({ summary }: { summary: WorkspaceSummary }) {
  const steps = setupSteps(summary);
  const next = steps.find((step) => !step.done);
  if (!next) return null;
  const done = steps.length - steps.filter((step) => !step.done).length;
  return (
    <Link
      {...next.link}
      className="group flex items-center gap-3 rounded-xl border border-duet-hair bg-duet-card px-4 py-3 hover:border-duet-accent/40"
    >
      <span className="type-caption shrink-0 rounded-full bg-duet-accent-soft px-2 py-0.5 font-medium text-duet-accent tabular-nums">
        {done} of {steps.length} done
      </span>
      <span className="type-label min-w-0 flex-1 truncate text-duet-ink">
        Finish setting up: <span className="font-semibold">{next.title}</span>
      </span>
      <IconChevronRight
        className="shrink-0 text-duet-ink-3 transition-transform group-hover:translate-x-0.5"
        size={18}
      />
    </Link>
  );
}

const PUT_TO_WORK: StarterId[] = ["notes", "pipeline", "intro"];

/** Work a Bot can start on from what the person already has, before any data is in. */
export function PutToWork({
  botName,
  onStarter,
}: {
  botName: string;
  onStarter: (starter: StarterId) => void;
}) {
  return (
    <section aria-labelledby="put-to-work">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="type-title font-semibold text-duet-ink" id="put-to-work">
          Put {botName} to work
        </h2>
        <p className="type-caption text-duet-ink-2">
          Start with what you have.
        </p>
      </div>
      <div className="grid gap-3 @3xl:grid-cols-3">
        {PUT_TO_WORK.map((id) => {
          const starter = STARTERS[id];
          return (
            <button
              className="group flex flex-col gap-2 rounded-xl border border-duet-hair bg-duet-card p-4 text-left transition-colors hover:border-duet-accent/40"
              key={id}
              onClick={() => onStarter(id)}
              type="button"
            >
              <starter.icon
                className="text-duet-accent"
                size={22}
                stroke={1.75}
              />
              <span>
                <span className="type-label block font-semibold text-duet-ink">
                  {starter.title}
                </span>
                <span className="type-caption mt-0.5 block text-duet-ink-2">
                  {starter.line}
                </span>
              </span>
              <IconArrowRight
                className="mt-auto self-end text-duet-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-duet-accent"
                size={16}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Where the day will show up, said plainly instead of a page of zeroes. */
export function EmptyDay() {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-duet-hair border-dashed px-6 py-10 text-center">
      <IconCalendarCheck className="text-duet-ink-3" size={32} stroke={1.5} />
      <h2 className="type-label mt-3 font-semibold text-duet-ink">
        Your day, in one place
      </h2>
      <p className="type-caption mt-1 max-w-[46ch] text-duet-ink-2">
        Meetings, follow-ups and Bot updates will appear here as you start
        working.
      </p>
      <Link
        className="type-caption mt-3 inline-flex items-center gap-1 font-medium text-duet-accent hover:underline"
        params={{ _splat: "o/tasks" }}
        to="/crm/$"
      >
        Add a follow-up
        <IconArrowRight size={14} />
      </Link>
    </section>
  );
}
