import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useMetadata } from "../objects/model";
import type { ConditionGroup, Step } from "../types";
import { ConditionsEditor } from "./ConditionsEditor";
import { EACH_ACTIONS, STEP_TYPES, TARGETS } from "./describe";
import { PickOne, TextField, text } from "./StepInputs";
import { ValuesEditor } from "./ValuesEditor";

type MoreStepFieldsProps = {
  step: Step;
  onChange: (step: Step) => void;
  object?: string;
  // The editor for the action a for_each step does, which is an ordinary step.
  renderAction: (action: Step, onChange: (action: Step) => void) => ReactNode;
};

const NumberField = ({
  label,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  value: unknown;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    <Input
      type="number"
      aria-label={label}
      className="w-32"
      min={min}
      step={step}
      value={Number(value ?? 0)}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </div>
);

const useObjectChoices = () => {
  const { data } = useMetadata();
  return (data?.objects ?? []).map((object) => ({
    id: object.name,
    label: object.label_plural,
  }));
};

const RecordFilter = ({
  step,
  onChange,
}: {
  step: Step;
  onChange: (step: Step) => void;
}) => (
  <div className="flex flex-col gap-1">
    <Label>Where</Label>
    <p className="text-xs text-muted-foreground">
      Each field must equal its value, such as company_id {"{{record.id}}"}. Add
      @ilike to the field for "contains".
    </p>
    <ValuesEditor
      value={(step.filter as Record<string, unknown>) ?? {}}
      onChange={(filter) => onChange({ ...step, filter })}
      object={text(step.object)}
    />
  </div>
);

/** The fields of the steps that find records, loop, wait, sort with AI, and book meetings. */
export const MoreStepFields = ({
  step,
  onChange,
  object,
  renderAction,
}: MoreStepFieldsProps) => {
  const objects = useObjectChoices();
  const set = (key: string) => (value: unknown) =>
    onChange({ ...step, [key]: value });

  switch (step.type) {
    case "find_record":
      return (
        <>
          <PickOne
            label="Find in"
            value={step.object}
            choices={objects}
            onChange={set("object")}
          />
          <RecordFilter step={step} onChange={onChange} />
          <div className="flex flex-wrap gap-2">
            <TextField
              label="Take the one with the highest"
              value={step.sort}
              onChange={set("sort")}
              placeholder="id"
            />
            <PickOne
              label="Order"
              value={step.order ?? "DESC"}
              choices={[
                { id: "DESC", label: "Highest first" },
                { id: "ASC", label: "Lowest first" },
              ]}
              onChange={set("order")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Later steps read it as {`{{steps.${step.id}.record.<field>}}`}, and
            conditions can check {`steps.${step.id}.found`}.
          </p>
        </>
      );
    case "for_each": {
      const action = step.do as Step | undefined;
      return (
        <>
          <PickOne
            label="For each record in"
            value={step.object}
            choices={objects}
            onChange={set("object")}
          />
          <RecordFilter step={step} onChange={onChange} />
          <NumberField
            label="At most"
            value={step.limit ?? 25}
            min={1}
            onChange={set("limit")}
          />
          <div className="flex flex-col gap-2 border-l-2 pl-3">
            <PickOne
              label="Do"
              value={action?.type}
              choices={EACH_ACTIONS.map((type) => ({
                id: type,
                label:
                  STEP_TYPES.find((each) => each.type === type)?.label ?? type,
              }))}
              onChange={(type) => {
                const made = STEP_TYPES.find((each) => each.type === type);
                if (made) {
                  set("do")({
                    id: action?.id ?? `${step.id}_do`,
                    ...made.make(),
                  });
                }
              }}
            />
            {action ? renderAction(action, (next) => set("do")(next)) : null}
          </div>
        </>
      );
    }
    case "wait_until":
      return (
        <>
          <ConditionsEditor
            object={object}
            value={step.when as ConditionGroup}
            onChange={set("when")}
            emptyText="Add the condition to wait for."
          />
          <div className="flex flex-wrap gap-4">
            <NumberField
              label="Check every (hours)"
              value={step.check_every_hours ?? 1}
              min={0.25}
              step={0.25}
              onChange={set("check_every_hours")}
            />
            <NumberField
              label="Give up after (days)"
              value={step.timeout_days ?? 7}
              min={0}
              onChange={set("timeout_days")}
            />
            <PickOne
              label="Then"
              value={step.on_timeout ?? "stop"}
              choices={[
                { id: "stop", label: "Stop the automation" },
                { id: "continue", label: "Carry on anyway" },
              ]}
              onChange={set("on_timeout")}
            />
          </div>
        </>
      );
    case "classify":
      return (
        <>
          <TextField
            label="Text to sort"
            value={step.text}
            onChange={set("text")}
            placeholder="{{meeting.outcome_notes}}"
          />
          <TextField
            label="Labels, separated by commas"
            value={((step.labels as string[] | undefined) ?? []).join(", ")}
            onChange={(value) =>
              set("labels")(
                value
                  .split(",")
                  .map((label) => label.trim())
                  .filter(Boolean),
              )
            }
          />
          <TextField
            label="Guidance for the AI (optional)"
            value={step.instructions}
            onChange={set("instructions")}
            multiline
          />
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col gap-1">
              <Label>Keep the label on</Label>
              <Select
                value={text(step.target) || "__none__"}
                onValueChange={(target) => {
                  const { target: _, field: __, ...rest } = step;
                  onChange(
                    target === "__none__"
                      ? (rest as Step)
                      : { ...rest, target, field: text(step.field) },
                  );
                }}
              >
                <SelectTrigger aria-label="Keep the label on">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nowhere</SelectItem>
                  {TARGETS.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {step.target ? (
              <TextField
                label="In the field"
                value={step.field}
                onChange={set("field")}
                placeholder="status or custom_fields.mood"
              />
            ) : null}
          </div>
        </>
      );
    case "create_meeting":
      return (
        <>
          <TextField label="Title" value={step.title} onChange={set("title")} />
          <TextField
            label="Starts"
            value={step.start}
            onChange={set("start")}
            placeholder="{{meeting.start_at | add_days:7}}"
          />
          <div className="flex flex-wrap gap-4">
            <NumberField
              label="Minutes"
              value={step.duration_minutes ?? 30}
              min={5}
              onChange={set("duration_minutes")}
            />
            <TextField
              label="Where (optional)"
              value={step.location}
              onChange={set("location")}
            />
          </div>
        </>
      );
    default:
      return null;
  }
};
