/* eslint-disable react-refresh/only-export-components */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanAccess, useNotify } from "ra-core";
import { CheckCircle2, CircleAlert, Plus, Zap } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import { crmApi, errorMessage } from "../api";
import { useAutomationInfo } from "../queries";
import type { Requirement, Workflow } from "../types";
import { describeTrigger } from "./describe";

export const workflowsKey = ["crm", "workflows"];

const NEED: Record<Requirement, { label: string; fix: string; to?: string }> = {
  mailbox: { label: "Mailbox", fix: "Connect a mailbox", to: "/profile" },
  model: {
    label: "AI model",
    fix: "add the model key (OPENAI_API_KEY) to the server's settings",
  },
  bot: { label: "Bot", fix: "set up a Bot first" },
};

const Readiness = () => {
  const { data: info } = useAutomationInfo();
  if (!info) return null;
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {(Object.keys(NEED) as Requirement[]).map((need) => (
        <span key={need} className="flex items-center gap-1">
          {info.ready[need] ? (
            <CheckCircle2 className="size-4 text-green-600" />
          ) : (
            <CircleAlert className="size-4 text-amber-600" />
          )}
          {NEED[need].label}:{" "}
          {info.ready[need] ? (
            "ready"
          ) : NEED[need].to ? (
            <Link to={NEED[need].to} className="underline">
              {NEED[need].fix}
            </Link>
          ) : (
            NEED[need].fix
          )}
        </span>
      ))}
    </div>
  );
};

const WorkflowCard = ({
  workflow,
  canEdit,
}: {
  workflow: Workflow;
  canEdit: boolean;
}) => {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { data: info } = useAutomationInfo();
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      crmApi(`/automation/workflows/${workflow.id}`, {
        method: "PUT",
        body: { enabled },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowsKey }),
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });
  const missing = workflow.needs.filter((need) => info && !info.ready[need]);
  const runs = workflow.runs ?? {};

  return (
    <Card className="py-4">
      <CardContent className="flex gap-4 items-start">
        <Switch
          checked={workflow.enabled}
          disabled={!canEdit || toggle.isPending}
          aria-label={`${workflow.name} on`}
          onCheckedChange={(enabled) => toggle.mutate(enabled)}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <Link
            to={`/automations/${workflow.id}`}
            className="font-medium hover:underline"
          >
            {workflow.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {workflow.description}
          </p>
          <p className="text-xs text-muted-foreground">
            <Zap className="inline size-3" />{" "}
            {describeTrigger(workflow.trigger)}
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {missing.map((need) => (
              <Badge key={need} variant="outline" className="text-amber-700">
                Needs: {NEED[need].label}
              </Badge>
            ))}
            {runs.completed ? (
              <Badge variant="secondary">{runs.completed} done</Badge>
            ) : null}
            {runs.waiting ? (
              <Badge variant="secondary">{runs.waiting} waiting</Badge>
            ) : null}
            {runs.failed ? (
              <Badge variant="destructive">{runs.failed} failed</Badge>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to={`/automations/${workflow.id}/runs`}>History</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

/** Every automation, switched on or off in place. */
export const AutomationsPage = () => {
  const { data: workflows = [], isPending } = useQuery({
    queryKey: workflowsKey,
    queryFn: () => crmApi<Workflow[]>("/automation/workflows"),
  });
  const { canAccess: canEdit = false } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 mt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Automations</h1>
        {canEdit ? (
          <Button asChild>
            <Link to="/automations/new">
              <Plus className="size-4" /> New automation
            </Link>
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Each one starts when something happens in the CRM, at a time, or when
        another app sends to it, then does its steps. The ready-made ones start
        switched off: read one, change what it says, and switch it on.
      </p>
      <Readiness />
      <Card className="py-4">
        <CardContent className="flex gap-4 items-start">
          <Switch checked disabled aria-label="Always on" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              Keep "Date updated" on every record
            </span>
            <p className="text-sm text-muted-foreground">
              Always on. Every change to a contact, company, deal, task, note,
              meeting or proposal sets its date updated, whoever or whatever
              made it. Moving a deal within its column doesn't count.
            </p>
          </div>
        </CardContent>
      </Card>
      {isPending
        ? null
        : workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              canEdit={canEdit}
            />
          ))}
    </div>
  );
};
