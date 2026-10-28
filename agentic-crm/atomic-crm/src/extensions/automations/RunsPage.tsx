import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanAccess, useNotify } from "ra-core";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { crmApi, errorMessage } from "../api";
import type { Run, Workflow } from "../types";
import { objectName, stepLabel } from "./describe";

const STATUS: Record<
  Run["status"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  queued: { label: "Starting", variant: "secondary" },
  running: { label: "Running", variant: "secondary" },
  waiting: { label: "Waiting", variant: "outline" },
  completed: { label: "Done", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  canceled: { label: "Canceled", variant: "outline" },
};

const RECORD_PAGES: Record<string, string> = {
  contacts: "contacts",
  companies: "companies",
  deals: "deals",
};

const RunRow = ({ run }: { run: Run }) => {
  const [open, setOpen] = useState(false);
  const { data: detail } = useQuery({
    queryKey: ["crm", "run", run.id],
    queryFn: () => crmApi<Run>(`/automation/runs/${run.id}`),
    enabled: open,
  });
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { canAccess: canEdit = false } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const cancel = useMutation({
    mutationFn: () =>
      crmApi(`/automation/runs/${run.id}/cancel`, { method: "POST" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["crm", "runs"] }),
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });
  const status = STATUS[run.status];
  const page = run.trigger.object
    ? RECORD_PAGES[run.trigger.object]
    : undefined;

  return (
    <li className="border-b last:border-0 py-2">
      <div className="flex items-center gap-3 text-sm">
        <Badge variant={status.variant}>{status.label}</Badge>
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => setOpen(!open)}
        >
          Started <RelativeDate date={run.created_at} />
          {run.trigger.object && run.trigger.recordId ? (
            <> for a {objectName(run.trigger.object)}</>
          ) : null}
          {run.status === "waiting" ? (
            <span className="text-muted-foreground">
              {" "}
              · continues <RelativeDate date={run.wake_at} />
            </span>
          ) : null}
        </button>
        {page && run.trigger.recordId ? (
          <Link
            to={`/${page}/${run.trigger.recordId}/show`}
            className="underline text-xs"
          >
            Open the {objectName(run.trigger.object)}
          </Link>
        ) : null}
        {canEdit && (run.status === "waiting" || run.status === "queued") ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => cancel.mutate()}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {run.error ? (
        <p className="text-sm text-destructive mt-1">{run.error}</p>
      ) : null}
      {open && detail?.log ? (
        <ol className="mt-2 ml-4 text-sm space-y-1">
          {detail.log.map((entry, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a log is append-only.
            <li key={index} className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">
                <RelativeDate date={entry.at} />
              </span>
              <span className="font-medium">{stepLabel(entry.type)}</span>
              <span
                className={
                  entry.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {entry.message}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
};

/** What an automation did, run by run, with each step's result. */
export const RunsPage = () => {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const { data: workflow } = useQuery({
    queryKey: ["crm", "workflows", id],
    queryFn: () => crmApi<Workflow>(`/automation/workflows/${id}`),
  });
  const { data } = useQuery({
    queryKey: ["crm", "runs", id, page],
    queryFn: () =>
      crmApi<{ data: Run[]; total: number }>(
        `/automation/workflows/${id}/runs?page=${page}`,
      ),
    refetchInterval: 10_000,
  });
  const runs = data?.data ?? [];

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 mt-4">
      <Link
        to={`/automations/${id}`}
        className="text-sm text-muted-foreground flex items-center gap-1"
      >
        <ArrowLeft className="size-4" /> {workflow?.name ?? "Automation"}
      </Link>
      <h1 className="text-2xl font-semibold">History</h1>
      <Card>
        <CardContent>
          {runs.length ? (
            <ul>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">It hasn't run yet.</p>
          )}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Newer
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={page * 25 >= (data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          Older
        </Button>
      </div>
    </div>
  );
};
