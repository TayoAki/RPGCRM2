import { useGetList, useGetMany, useNotify, useUpdate } from "ra-core";
import { type ReactNode, useMemo } from "react";
import { Link } from "react-router";
import { Checkbox } from "@/components/ui/checkbox";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import type { Meeting } from "../types";
import { SHOWN, useDueTasks } from "./today";

const DAY = 86_400_000;

type StageChange = {
  id: number;
  deal_id: number;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
};

const Group = ({
  title,
  empty,
  children,
  count,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-2 rounded-md border bg-background p-3">
    <h2 className="text-sm font-medium">{title}</h2>
    {count ? (
      <ul className="flex flex-col gap-2">{children}</ul>
    ) : (
      <p className="text-sm text-muted-foreground">{empty}</p>
    )}
  </section>
);

const DueTasks = () => {
  const { data: tasks = [], total = 0 } = useDueTasks();
  const [update] = useUpdate();
  const notify = useNotify();
  const now = Date.now();
  return (
    <Group
      title={total > SHOWN ? `Due today (${total})` : "Due today"}
      empty="Nothing due. Nice."
      count={tasks.length}
    >
      {tasks.map((task) => (
        <li key={task.id} className="flex items-start gap-2 text-sm">
          <Checkbox
            aria-label={`Done: ${task.text}`}
            className="mt-0.5"
            onCheckedChange={() =>
              update(
                "tasks",
                {
                  id: task.id,
                  data: { done_date: new Date().toISOString() },
                  previousData: task,
                },
                {
                  onError: () =>
                    notify("Couldn't mark it done.", { type: "error" }),
                },
              )
            }
          />
          <Link
            to={`/contacts/${task.contact_id}/show`}
            className="min-w-0 flex-1 hover:underline"
          >
            <span className="line-clamp-2">{task.text}</span>
            <span
              className={
                Date.parse(task.due_date) < now - DAY / 2
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              <RelativeDate date={task.due_date} />
            </span>
          </Link>
        </li>
      ))}
    </Group>
  );
};

const NextMeetings = () => {
  const filter = useMemo(
    () => ({
      "start_at@gte": new Date().toISOString(),
      "start_at@lt": new Date(Date.now() + 7 * DAY).toISOString(),
      status: "scheduled",
    }),
    [],
  );
  const { data: meetings = [] } = useGetList<Meeting>("meetings", {
    filter,
    sort: { field: "start_at", order: "ASC" },
    pagination: { page: 1, perPage: 5 },
  });
  return (
    <Group
      title="Coming up"
      empty="No meetings this week."
      count={meetings.length}
    >
      {meetings.map((meeting) => (
        <li key={meeting.id} className="text-sm">
          <Link
            to={
              meeting.contact_id
                ? `/contacts/${meeting.contact_id}/show`
                : "/meetings"
            }
            className="hover:underline"
          >
            {meeting.title}
          </Link>
          <div className="text-xs text-muted-foreground">
            <RelativeDate date={meeting.start_at} />
          </div>
        </li>
      ))}
    </Group>
  );
};

const MovedDeals = () => {
  const filter = useMemo(
    () => ({
      "changed_at@gte": new Date(Date.now() - DAY).toISOString(),
      "from_stage@not.is": null,
    }),
    [],
  );
  const { data: changes = [] } = useGetList<StageChange>("deal_stage_history", {
    filter,
    sort: { field: "changed_at", order: "DESC" },
    pagination: { page: 1, perPage: 5 },
  });
  const ids = useMemo(
    () => [...new Set(changes.map((each) => each.deal_id))],
    [changes],
  );
  const { data: deals = [] } = useGetMany<{ id: number; name: string }>(
    "deals",
    { ids },
  );
  const nameOf = (id: number) =>
    deals.find((deal) => deal.id === id)?.name ?? `Deal #${id}`;
  const stage = (value: string | null) => (value ?? "").replaceAll("-", " ");
  return (
    <Group
      title="Deals that moved"
      empty="No stage changes in the last day."
      count={changes.length}
    >
      {changes.map((change) => (
        <li key={change.id} className="text-sm">
          <Link
            to={`/deals/${change.deal_id}/show`}
            className="hover:underline"
          >
            {nameOf(change.deal_id)}
          </Link>
          <div className="text-xs capitalize text-muted-foreground">
            {stage(change.from_stage)} to {stage(change.to_stage)}
          </div>
        </li>
      ))}
    </Group>
  );
};

/** What the day asks of the person: tasks due, meetings coming up, and deals that moved. */
export const TodayPanel = () => (
  <aside
    aria-label="Today"
    className="hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l bg-secondary/30 p-3 lg:flex"
  >
    <h2 className="px-1 text-sm font-semibold">Today</h2>
    <DueTasks />
    <NextMeetings />
    <MovedDeals />
  </aside>
);
