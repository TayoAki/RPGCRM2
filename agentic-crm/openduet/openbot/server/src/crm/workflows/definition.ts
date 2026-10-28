import { CronExpressionParser } from "cron-parser";
import { z } from "zod";

/** Records automations can start from and act on. */
export const WORKFLOW_OBJECTS = [
  "contacts",
  "companies",
  "deals",
  "tasks",
  "contact_notes",
  "deal_notes",
  "meetings",
  "proposals",
  "emails",
] as const;
export type WorkflowObject = (typeof WORKFLOW_OBJECTS)[number];

/** The records a step can act on, relative to the one the run is about. */
export const TARGETS = [
  "record",
  "contact",
  "contacts",
  "company",
  "deal",
  "meeting",
  "proposal",
] as const;
export type Target = (typeof TARGETS)[number];

export const OPERATORS = [
  "is",
  "is_not",
  "in",
  "not_in",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "changed",
  "gt",
  "lt",
  "before",
  "after",
  "older_than_days",
  "newer_than_days",
] as const;
export type Operator = (typeof OPERATORS)[number];

const object = z.enum(WORKFLOW_OBJECTS);
const fieldPath = z
  .string()
  .regex(/^[a-z_][a-z0-9_]*(\.[a-z0-9_]+)*$/i, "Name a field, such as stage.")
  .max(120);
const template = z.string().max(20_000);

export const condition = z.object({
  field: fieldPath,
  op: z.enum(OPERATORS),
  value: z.unknown().optional(),
});
export type Condition = z.infer<typeof condition>;

export const conditionGroup = z.object({
  match: z.enum(["all", "any"]).default("all"),
  conditions: z.array(condition).max(20).default([]),
});
export type ConditionGroup = z.infer<typeof conditionGroup>;

const cron = z.string().refine((value) => {
  try {
    CronExpressionParser.parse(value);
    return value.trim().split(/\s+/).length === 5;
  } catch {
    return false;
  }
}, "Use a schedule like 0 9 * * 1-5 (minute, hour, day, month, weekday).");

const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone.");

export const trigger = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("record"),
    object,
    on: z.array(z.enum(["created", "updated", "deleted"])).min(1),
    when: conditionGroup.optional(),
  }),
  z.object({
    type: z.literal("date"),
    object,
    field: z.string().regex(/^[a-z_]+$/),
    // Negative is before the date: -1440 is a day before.
    offset_minutes: z.number().int().min(-525_600).max(525_600).default(0),
    when: conditionGroup.optional(),
  }),
  z.object({
    type: z.literal("schedule"),
    cron,
    timezone: timezone.optional(),
    // With an object, one run for each of its records that matches.
    object: object.optional(),
    when: conditionGroup.optional(),
  }),
  z.object({ type: z.literal("webhook") }),
  z.object({ type: z.literal("manual"), object }),
]);
export type Trigger = z.infer<typeof trigger>;

const stepId = z
  .string()
  .regex(/^[a-z0-9_]{1,40}$/, "Step ids are lowercase letters, digits and _.");

const values = z.record(z.string().regex(/^[a-z_]+$/), z.unknown());

const leaf = z.discriminatedUnion("type", [
  z.object({
    id: stepId,
    type: z.literal("update_record"),
    target: z.enum(TARGETS),
    values,
  }),
  z.object({
    id: stepId,
    type: z.literal("create_record"),
    object,
    values,
  }),
  z.object({
    id: stepId,
    type: z.literal("delete_record"),
    target: z.enum(TARGETS),
  }),
  z.object({
    id: stepId,
    type: z.literal("upsert_contact"),
    email: template,
    first_name: template.optional(),
    last_name: template.optional(),
    phone: template.optional(),
    company_name: template.optional(),
    lead_source: template.optional(),
    lead_source_detail: template.optional(),
  }),
  z.object({
    id: stepId,
    type: z.literal("create_task"),
    text: template,
    task_type: z.string().max(40).optional(),
    due_in_days: z.number().min(0).max(365).default(0),
  }),
  z.object({
    id: stepId,
    type: z.literal("add_note"),
    target: z.enum(["contact", "deal"]),
    text: template,
  }),
  z.object({
    id: stepId,
    type: z.literal("send_email"),
    to: template.default("{{contact.email}}"),
    subject: template,
    body: template,
    // The model writes the body from these, with the body above as its starting point.
    ai_instructions: template.optional(),
    // Kept as a draft, with a task for the owner to read and send it.
    review_first: z.boolean().default(false),
  }),
  z.object({
    id: stepId,
    type: z.literal("ai_write"),
    prompt: template,
  }),
  z.object({
    id: stepId,
    type: z.literal("ai_agent"),
    instructions: template,
  }),
  z.object({
    id: stepId,
    type: z.literal("generate_proposal"),
    instructions: template.optional(),
  }),
  z.object({
    id: stepId,
    type: z.literal("send_proposal"),
    subject: template,
    body: template,
  }),
  z.object({
    id: stepId,
    type: z.literal("delay"),
    amount: z.number().min(0).max(100_000).default(0),
    unit: z.enum(["minutes", "hours", "days"]).default("hours"),
    // Instead of an amount: until this moment, such as {{meeting.start_at | add_hours:-1}}.
    until: template.optional(),
  }),
  z.object({
    id: stepId,
    type: z.literal("stop"),
  }),
  z.object({
    id: stepId,
    type: z.literal("http_request"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
    url: template,
    headers: z.record(z.string(), template).default({}),
    body: template.optional(),
  }),
]);

export type LeafStep = z.infer<typeof leaf>;
export type IfStep = {
  id: string;
  type: "if";
  when: ConditionGroup;
  if_true: Step[];
  if_false: Step[];
};
export type Step = LeafStep | IfStep;

export const step: z.ZodType<Step> = z.lazy(() =>
  z.union([
    leaf,
    z.object({
      id: stepId,
      type: z.literal("if"),
      when: conditionGroup,
      if_true: z.array(step).max(50).default([]),
      if_false: z.array(step).max(50).default([]),
    }),
  ]),
) as z.ZodType<Step>;

export const workflowInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(""),
    enabled: z.boolean().default(false),
    trigger,
    steps: z.array(step).max(50),
  })
  .superRefine((workflow, context) => {
    const seen = new Set<string>();
    const visit = (steps: Step[]) => {
      for (const each of steps) {
        if (seen.has(each.id)) {
          context.addIssue({
            code: "custom",
            message: `Two steps are called ${each.id}.`,
            path: ["steps"],
          });
        }
        seen.add(each.id);
        if (each.type === "if") {
          visit(each.if_true);
          visit(each.if_false);
        }
      }
    };
    visit(workflow.steps);
  });
export type WorkflowInput = z.infer<typeof workflowInput>;
