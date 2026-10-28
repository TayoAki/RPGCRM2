import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { useConfigurationContext } from "../../components/atomic-crm/root/ConfigurationContext";
import type { ConditionGroup, Step } from "../types";
import { ConditionsEditor } from "./ConditionsEditor";
import { newStepId, OBJECTS, STEP_TYPES, stepLabel, TARGETS } from "./describe";
import { MoreStepFields } from "./MoreStepFields";
import { PickOne, TextField, text } from "./StepInputs";
import { ValuesEditor } from "./ValuesEditor";

type StepProps = {
  step: Step;
  onChange: (step: Step) => void;
  object?: string;
  all: Step[];
};

const objectChoices = OBJECTS.map((object) => ({
  id: object.id,
  label: object.many,
}));

const TARGET_OBJECTS: Record<string, string> = {
  contact: "contacts",
  contacts: "contacts",
  company: "companies",
  deal: "deals",
  meeting: "meetings",
  proposal: "proposals",
};

const StepFields = ({ step, onChange, object, all }: StepProps) => {
  const { taskTypes } = useConfigurationContext();
  const set = (key: string) => (value: unknown) =>
    onChange({ ...step, [key]: value });

  switch (step.type) {
    case "send_email":
      return (
        <>
          <TextField label="To" value={step.to} onChange={set("to")} />
          <TextField
            label="Subject"
            value={step.subject}
            onChange={set("subject")}
          />
          <TextField
            label="Message"
            value={step.body}
            onChange={set("body")}
            multiline
          />
          <div className="flex items-center gap-2">
            <Switch
              id={`${step.id}-ai`}
              checked={step.ai_instructions !== undefined}
              onCheckedChange={(on) => {
                const { ai_instructions: _, ...rest } = step;
                onChange(
                  on ? { ...rest, ai_instructions: "" } : (rest as Step),
                );
              }}
            />
            <Label htmlFor={`${step.id}-ai`}>
              Let AI write it, starting from the message above
            </Label>
          </div>
          {step.ai_instructions !== undefined ? (
            <TextField
              label="Tell the AI what to write"
              value={step.ai_instructions}
              onChange={set("ai_instructions")}
              multiline
            />
          ) : null}
          <div className="flex items-center gap-2">
            <Switch
              id={`${step.id}-review`}
              checked={Boolean(step.review_first)}
              onCheckedChange={set("review_first")}
            />
            <Label htmlFor={`${step.id}-review`}>
              Keep it as a draft for the owner to read and send
            </Label>
          </div>
        </>
      );
    case "update_record":
      return (
        <>
          <PickOne
            label="Which record"
            value={step.target}
            choices={TARGETS.map((target) => ({
              id: target.id,
              label: target.label,
            }))}
            onChange={set("target")}
          />
          <ValuesEditor
            value={(step.values as Record<string, unknown>) ?? {}}
            onChange={set("values")}
            object={
              step.target === "record"
                ? object
                : TARGET_OBJECTS[text(step.target)]
            }
          />
        </>
      );
    case "delete_record":
      return (
        <PickOne
          label="Which record"
          value={step.target}
          choices={TARGETS.map((target) => ({
            id: target.id,
            label: target.label,
          }))}
          onChange={set("target")}
        />
      );
    case "create_record":
      return (
        <>
          <PickOne
            label="Kind"
            value={step.object}
            choices={objectChoices}
            onChange={set("object")}
          />
          <ValuesEditor
            value={(step.values as Record<string, unknown>) ?? {}}
            onChange={set("values")}
            object={text(step.object)}
          />
        </>
      );
    case "upsert_contact":
      return (
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["email", "Email"],
              ["first_name", "First name"],
              ["last_name", "Last name"],
              ["phone", "Phone"],
              ["company_name", "Company"],
              ["lead_source", "Lead source"],
              ["lead_source_detail", "Campaign or referrer"],
            ] as const
          ).map(([key, label]) => (
            <TextField
              key={key}
              label={label}
              value={step[key]}
              onChange={set(key)}
            />
          ))}
        </div>
      );
    case "create_task":
      return (
        <>
          <TextField label="Task" value={step.text} onChange={set("text")} />
          <div className="grid grid-cols-2 gap-3">
            <PickOne
              label="Type"
              value={step.task_type ?? "follow-up"}
              choices={taskTypes.map((type) => ({
                id: type.value,
                label: type.label,
              }))}
              onChange={set("task_type")}
            />
            <div className="flex flex-col gap-1">
              <Label>Due in (days)</Label>
              <Input
                type="number"
                min={0}
                aria-label="Due in days"
                value={Number(step.due_in_days ?? 0)}
                onChange={(event) =>
                  set("due_in_days")(Number(event.target.value))
                }
              />
            </div>
          </div>
        </>
      );
    case "add_note":
      return (
        <>
          <PickOne
            label="On"
            value={step.target}
            choices={[
              { id: "contact", label: "The contact" },
              { id: "deal", label: "The deal" },
            ]}
            onChange={set("target")}
          />
          <TextField
            label="Note"
            value={step.text}
            onChange={set("text")}
            multiline
          />
        </>
      );
    case "delay":
      return step.until !== undefined ? (
        <>
          <TextField
            label="Wait until"
            value={step.until}
            onChange={set("until")}
            placeholder="{{meeting.start_at | add_hours:-1}}"
          />
          <Button
            type="button"
            variant="link"
            className="self-start px-0"
            onClick={() => {
              const { until: _, ...rest } = step;
              onChange({ ...(rest as Step), amount: 1, unit: "days" });
            }}
          >
            Wait for an amount of time instead
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              aria-label="How long"
              className="w-24"
              value={Number(step.amount ?? 0)}
              onChange={(event) => set("amount")(Number(event.target.value))}
            />
            <Select
              value={text(step.unit) || "hours"}
              onValueChange={set("unit")}
            >
              <SelectTrigger className="w-32" aria-label="Unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">minutes</SelectItem>
                <SelectItem value="hours">hours</SelectItem>
                <SelectItem value="days">days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="link"
            className="self-start px-0"
            onClick={() => onChange({ ...step, until: "" })}
          >
            Wait until a moment instead
          </Button>
        </>
      );
    case "if":
      return (
        <>
          <ConditionsEditor
            object={object}
            value={step.when as ConditionGroup}
            onChange={set("when")}
            emptyText="Add a condition."
          />
          <div className="border-l-2 pl-3 flex flex-col gap-2">
            <span className="text-sm font-medium">Then</span>
            <StepsEditor
              steps={(step.if_true as Step[]) ?? []}
              onChange={set("if_true")}
              object={object}
              all={all}
            />
          </div>
          <div className="border-l-2 pl-3 flex flex-col gap-2">
            <span className="text-sm font-medium">Otherwise</span>
            <StepsEditor
              steps={(step.if_false as Step[]) ?? []}
              onChange={set("if_false")}
              object={object}
              all={all}
            />
          </div>
        </>
      );
    case "ai_write":
      return (
        <TextField
          label="What to write"
          value={step.prompt}
          onChange={set("prompt")}
          multiline
        />
      );
    case "ai_agent":
      return (
        <TextField
          label="What the Bot should do"
          value={step.instructions}
          onChange={set("instructions")}
          multiline
        />
      );
    case "generate_proposal":
      return (
        <TextField
          label="Anything to say to the AI (optional)"
          value={step.instructions}
          onChange={set("instructions")}
          multiline
        />
      );
    case "send_proposal":
      return (
        <>
          <TextField
            label="Subject"
            value={step.subject}
            onChange={set("subject")}
          />
          <TextField
            label="Message (include {{proposal.url}})"
            value={step.body}
            onChange={set("body")}
            multiline
          />
        </>
      );
    case "http_request":
      return (
        <>
          <div className="flex gap-2">
            <Select
              value={text(step.method) || "POST"}
              onValueChange={set("method")}
            >
              <SelectTrigger className="w-28" aria-label="Method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Address"
              placeholder="https://"
              value={text(step.url)}
              onChange={(event) => set("url")(event.target.value)}
            />
          </div>
          <TextField
            label="Body"
            value={step.body}
            onChange={set("body")}
            multiline
          />
        </>
      );
    default:
      return (
        <MoreStepFields
          step={step}
          onChange={onChange}
          object={object}
          renderAction={(action, change) => (
            <StepFields
              step={action}
              onChange={change}
              object={TARGET_OBJECTS[text(step.object)] ?? text(step.object)}
              all={all}
            />
          )}
        />
      );
  }
};

const StepCard = ({
  step,
  onChange,
  onRemove,
  onMove,
  object,
  all,
  first,
  last,
}: StepProps & {
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
  first: boolean;
  last: boolean;
}) => (
  <Card className="py-3">
    <CardContent className="flex flex-col gap-3 px-4">
      <div className="flex items-center gap-2">
        <span className="font-medium flex-1">
          {stepLabel(step.type)}{" "}
          <span className="text-xs text-muted-foreground font-mono">
            {step.id}
          </span>
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Move up"
          disabled={first}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Move down"
          disabled={last}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Remove ${stepLabel(step.type)}`}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <StepFields step={step} onChange={onChange} object={object} all={all} />
    </CardContent>
  </Card>
);

/** A list of steps, run in order. Branches of an if/otherwise are lists of their own. */
export const StepsEditor = ({
  steps,
  onChange,
  object,
  all,
}: {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  object?: string;
  all: Step[];
}) => {
  const replace = (index: number, step: Step) =>
    onChange(steps.map((each, at) => (at === index ? step : each)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...steps];
    const [taken] = next.splice(index, 1);
    if (taken) next.splice(index + by, 0, taken);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, index) => (
        <StepCard
          key={step.id}
          step={step}
          object={object}
          all={all}
          first={index === 0}
          last={index === steps.length - 1}
          onChange={(next) => replace(index, next)}
          onRemove={() => onChange(steps.filter((_, at) => at !== index))}
          onMove={(by) => move(index, by)}
        />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
          >
            <Plus className="size-4" /> Add a step
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
          {STEP_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.type}
              onSelect={() =>
                onChange([
                  ...steps,
                  { id: newStepId(type.type, all), ...type.make() } as Step,
                ])
              }
            >
              <div className="flex flex-col">
                <span>{type.label}</span>
                <span className="text-xs text-muted-foreground">
                  {type.hint}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
