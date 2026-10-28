import { useQuery } from "@tanstack/react-query";
import { useNotify, useRecordContext } from "ra-core";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { crmApi, errorMessage } from "../api";
import type { Workflow } from "../types";
import { workflowsKey } from "./AutomationsPage";

/** Runs one of the automations that are started by hand on this record. Hidden when there are none. */
export const RunAutomationButton = ({ object }: { object: string }) => {
  const record = useRecordContext<{ id: number | string }>();
  const notify = useNotify();
  const { data: workflows = [] } = useQuery({
    queryKey: workflowsKey,
    queryFn: () => crmApi<Workflow[]>("/automation/workflows"),
  });
  const manual = workflows.filter(
    (workflow) =>
      workflow.enabled &&
      workflow.trigger.type === "manual" &&
      workflow.trigger.object === object,
  );
  if (!record || !manual.length) return null;

  const run = async (workflow: Workflow) => {
    try {
      await crmApi(`/automation/workflows/${workflow.id}/run`, {
        method: "POST",
        body: { record_id: record.id },
      });
      notify(`Started "${workflow.name}".`);
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Zap className="size-4" />
          Run
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {manual.map((workflow) => (
          <DropdownMenuItem key={workflow.id} onSelect={() => run(workflow)}>
            {workflow.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
