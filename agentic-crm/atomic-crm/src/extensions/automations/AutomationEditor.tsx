import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanAccess, useNotify } from "ra-core";
import { ArrowLeft, Copy } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { crmApi, errorMessage } from "../api";
import type { Workflow } from "../types";
import { PLACEHOLDERS } from "./describe";
import { StepsEditor } from "./StepsEditor";
import { TriggerEditor } from "./TriggerEditor";
import { workflowsKey } from "./AutomationsPage";

const BLANK: Pick<
  Workflow,
  "name" | "description" | "enabled" | "trigger" | "steps"
> = {
  name: "",
  description: "",
  enabled: false,
  trigger: { type: "record", object: "deals", on: ["updated"] },
  steps: [],
};

const Placeholders = () => (
  <details className="text-sm">
    <summary className="cursor-pointer text-muted-foreground">
      What you can put in {"{{ }}"}
    </summary>
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {PLACEHOLDERS.map(([code, meaning]) => (
        <div key={code} className="contents">
          <dt className="font-mono text-xs">{code}</dt>
          <dd className="text-muted-foreground">{meaning}</dd>
        </div>
      ))}
    </dl>
  </details>
);

const Editor = ({ initial }: { initial: Workflow | typeof BLANK }) => {
  const [workflow, setWorkflow] = useState(initial);
  const { canAccess: canEdit } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notify = useNotify();
  const id = "id" in initial ? initial.id : null;
  const object =
    "object" in workflow.trigger ? workflow.trigger.object : undefined;

  const save = useMutation({
    mutationFn: () =>
      crmApi<Workflow>(
        id ? `/automation/workflows/${id}` : "/automation/workflows",
        {
          method: id ? "PUT" : "POST",
          body: {
            name: workflow.name,
            description: workflow.description,
            enabled: workflow.enabled,
            trigger: workflow.trigger,
            steps: workflow.steps,
          },
        },
      ),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: workflowsKey });
      notify("Automation saved.");
      if (!id) navigate(`/automations/${saved.id}`);
    },
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });
  const remove = useMutation({
    mutationFn: () =>
      crmApi(`/automation/workflows/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workflowsKey });
      navigate("/automations");
    },
  });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 pb-24">
      <Link
        to="/automations"
        className="text-sm text-muted-foreground flex items-center gap-1"
      >
        <ArrowLeft className="size-4" /> Automations
      </Link>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="automation-name">Name</Label>
            <Input
              id="automation-name"
              value={workflow.name}
              onChange={(event) =>
                setWorkflow({ ...workflow, name: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="automation-description">What it does</Label>
            <Textarea
              id="automation-description"
              rows={2}
              value={workflow.description}
              onChange={(event) =>
                setWorkflow({ ...workflow, description: event.target.value })
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="automation-enabled"
              checked={workflow.enabled}
              onCheckedChange={(enabled) =>
                setWorkflow({ ...workflow, enabled })
              }
            />
            <Label htmlFor="automation-enabled">On</Label>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Starts</h2>
          <TriggerEditor
            value={workflow.trigger}
            onChange={(trigger) => setWorkflow({ ...workflow, trigger })}
          />
          {workflow.trigger.type === "webhook" &&
          "webhook_url" in initial &&
          initial.webhook_url ? (
            <div className="flex flex-col gap-1">
              <Label>Its address (keep it private)</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={initial.webhook_url}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy the address"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(initial.webhook_url ?? "")
                      .then(() => notify("Copied."))
                  }
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Post JSON or a form to it. Its fields are{" "}
                {"{{trigger.payload.<field>}}"}.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Then</h2>
          <Placeholders />
          <StepsEditor
            steps={workflow.steps}
            onChange={(steps) => setWorkflow({ ...workflow, steps })}
            object={object}
            all={workflow.steps}
          />
        </CardContent>
      </Card>
      {canEdit ? (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
          <div className="max-w-3xl mx-auto flex justify-between">
            {id ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => remove.mutate()}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {id ? (
                <Button type="button" variant="outline" asChild>
                  <Link to={`/automations/${id}/runs`}>History</Link>
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={save.isPending || !workflow.name}
                onClick={() => save.mutate()}
              >
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const AutomationEditor = () => {
  const { id } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: [...workflowsKey, id],
    queryFn: () => crmApi<Workflow>(`/automation/workflows/${id}`),
    enabled: Boolean(id) && id !== "new",
  });
  if (id === "new") return <Editor initial={BLANK} />;
  if (isError) {
    return (
      <p className="max-w-3xl mx-auto mt-8 text-muted-foreground">
        That automation doesn't exist.{" "}
        <Link to="/automations" className="underline">
          See them all
        </Link>
        .
      </p>
    );
  }
  if (isPending || !data) return null;
  return <Editor key={String(data.id)} initial={data} />;
};
