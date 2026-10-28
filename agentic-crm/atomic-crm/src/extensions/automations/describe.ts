import type { Condition, ConditionGroup, Step, Trigger } from "../types";

export const OBJECTS: { id: string; one: string; many: string }[] = [
  { id: "contacts", one: "contact", many: "Contacts" },
  { id: "companies", one: "company", many: "Companies" },
  { id: "deals", one: "deal", many: "Deals" },
  { id: "meetings", one: "meeting", many: "Meetings" },
  { id: "proposals", one: "proposal", many: "Proposals" },
  { id: "tasks", one: "task", many: "Tasks" },
  { id: "emails", one: "email", many: "Emails" },
  { id: "contact_notes", one: "contact note", many: "Contact notes" },
  { id: "deal_notes", one: "deal note", many: "Deal notes" },
];

export const objectName = (id: string | undefined) =>
  OBJECTS.find((object) => object.id === id)?.one ?? "record";

export const OPERATORS: { id: string; label: string; needsValue: boolean }[] = [
  { id: "is", label: "is", needsValue: true },
  { id: "is_not", label: "is not", needsValue: true },
  { id: "in", label: "is one of", needsValue: true },
  { id: "not_in", label: "is none of", needsValue: true },
  { id: "contains", label: "contains", needsValue: true },
  { id: "not_contains", label: "doesn't contain", needsValue: true },
  { id: "is_empty", label: "is empty", needsValue: false },
  { id: "is_not_empty", label: "is not empty", needsValue: false },
  { id: "changed", label: "just changed", needsValue: false },
  { id: "gt", label: "is more than", needsValue: true },
  { id: "lt", label: "is less than", needsValue: true },
  { id: "before", label: "is before", needsValue: true },
  { id: "after", label: "is after", needsValue: true },
  { id: "older_than_days", label: "is more days ago than", needsValue: true },
  { id: "newer_than_days", label: "is within the last days", needsValue: true },
];

const fieldName = (field: string) =>
  field
    .replace(/^record\./, "")
    .replaceAll("_", " ")
    .replaceAll(".", "'s ");

export const describeCondition = (condition: Condition) => {
  const op = OPERATORS.find((each) => each.id === condition.op);
  return `${fieldName(condition.field)} ${op?.label ?? condition.op}${
    op?.needsValue ? ` ${String(condition.value ?? "")}` : ""
  }`;
};

export const describeConditions = (group: ConditionGroup | undefined) =>
  group?.conditions.length
    ? group.conditions
        .map(describeCondition)
        .join(group.match === "any" ? " or " : " and ")
    : "";

const duration = (minutes: number) => {
  const abs = Math.abs(minutes);
  if (abs % 1440 === 0) return `${abs / 1440} day${abs === 1440 ? "" : "s"}`;
  if (abs % 60 === 0) return `${abs / 60} hour${abs === 60 ? "" : "s"}`;
  return `${abs} minute${abs === 1 ? "" : "s"}`;
};

export const describeTrigger = (trigger: Trigger): string => {
  const when = "when" in trigger ? describeConditions(trigger.when) : "";
  const suffix = when ? `, if ${when}` : "";
  switch (trigger.type) {
    case "record":
      return `When a ${objectName(trigger.object)} is ${trigger.on.join(" or ")}${suffix}`;
    case "date":
      return trigger.offset_minutes === 0
        ? `At a ${objectName(trigger.object)}'s ${fieldName(trigger.field)}${suffix}`
        : `${duration(trigger.offset_minutes)} ${trigger.offset_minutes < 0 ? "before" : "after"} a ${objectName(trigger.object)}'s ${fieldName(trigger.field)}${suffix}`;
    case "schedule":
      return `On a schedule (${trigger.cron})${trigger.object ? `, for each ${objectName(trigger.object)}` : ""}${suffix}`;
    case "webhook":
      return "When another app sends to its address";
    case "manual":
      return `When someone runs it on a ${objectName(trigger.object)}`;
  }
};

export type StepType = {
  type: string;
  label: string;
  hint: string;
  make: () => Omit<Step, "id">;
};

export const STEP_TYPES: StepType[] = [
  {
    type: "send_email",
    label: "Send an email",
    hint: "From the owner's mailbox. The model can write it.",
    make: () => ({
      type: "send_email",
      to: "{{contact.email}}",
      subject: "",
      body: "Hi {{contact.first_name}},\n\n",
      review_first: false,
    }),
  },
  {
    type: "update_record",
    label: "Change a record",
    hint: "Set fields on this record, its contact, deal, company…",
    make: () => ({ type: "update_record", target: "record", values: {} }),
  },
  {
    type: "create_task",
    label: "Add a task",
    hint: "For the record's owner.",
    make: () => ({ type: "create_task", text: "", due_in_days: 1 }),
  },
  {
    type: "add_note",
    label: "Add a note",
    hint: "To the contact or the deal.",
    make: () => ({ type: "add_note", target: "contact", text: "" }),
  },
  {
    type: "delay",
    label: "Wait",
    hint: "For a while, or until a moment.",
    make: () => ({ type: "delay", amount: 1, unit: "days" }),
  },
  {
    type: "if",
    label: "If / otherwise",
    hint: "Do different things depending on fields.",
    make: () => ({
      type: "if",
      when: { match: "all", conditions: [] },
      if_true: [],
      if_false: [],
    }),
  },
  {
    type: "create_record",
    label: "Create a record",
    hint: "A deal, a contact, a meeting…",
    make: () => ({ type: "create_record", object: "deals", values: {} }),
  },
  {
    type: "upsert_contact",
    label: "Find or add a contact",
    hint: "By email, e.g. from a form. Later steps use it.",
    make: () => ({
      type: "upsert_contact",
      email: "{{trigger.payload.email}}",
    }),
  },
  {
    type: "generate_proposal",
    label: "Write a proposal",
    hint: "The model drafts it from the deal and its notes.",
    make: () => ({ type: "generate_proposal", instructions: "" }),
  },
  {
    type: "send_proposal",
    label: "Send the proposal",
    hint: "Emails the client their link.",
    make: () => ({
      type: "send_proposal",
      subject: "Your proposal: {{proposal.title}}",
      body: "Hi {{contact.first_name}},\n\nHere is our proposal:\n\n{{proposal.url}}\n\n{{owner.first_name}}",
    }),
  },
  {
    type: "ai_write",
    label: "Write text with AI",
    hint: "Later steps use it as {{steps.<id>.text}}.",
    make: () => ({ type: "ai_write", prompt: "" }),
  },
  {
    type: "ai_agent",
    label: "Ask the Bot",
    hint: "A task the Bot works on, with the record as context.",
    make: () => ({ type: "ai_agent", instructions: "" }),
  },
  {
    type: "http_request",
    label: "Call another app",
    hint: "An HTTP request to a web address.",
    make: () => ({
      type: "http_request",
      method: "POST",
      url: "",
      headers: {},
      body: "",
    }),
  },
  {
    type: "delete_record",
    label: "Delete a record",
    hint: "Careful: it can't be undone.",
    make: () => ({ type: "delete_record", target: "record" }),
  },
  {
    type: "stop",
    label: "Stop",
    hint: "End the automation here.",
    make: () => ({ type: "stop" }),
  },
];

export const stepLabel = (type: string) =>
  STEP_TYPES.find((each) => each.type === type)?.label ?? type;

export const TARGETS = [
  { id: "record", label: "This record" },
  { id: "contact", label: "Its contact" },
  { id: "contacts", label: "All the deal's contacts" },
  { id: "company", label: "Its company" },
  { id: "deal", label: "Its deal" },
  { id: "meeting", label: "Its meeting" },
  { id: "proposal", label: "Its proposal" },
];

export const PLACEHOLDERS = [
  ["{{contact.first_name}}", "The contact's first name"],
  ["{{contact.name}}", "Their full name"],
  ["{{contact.email}}", "Their email"],
  ["{{company.name}}", "Their company"],
  ["{{deal.name}}", "The deal"],
  ["{{deal.amount | money}}", "The deal's amount"],
  ["{{meeting.title}}", "The meeting"],
  ["{{meeting.start_at | datetime}}", "When it starts"],
  ["{{meeting.location}}", "Where, or its video link"],
  ["{{meeting.outcome_notes}}", "The call notes"],
  ["{{proposal.url}}", "The client's proposal link"],
  ["{{owner.first_name}}", "The record owner's name"],
  ["{{record.<field>}}", "Any field of the record"],
  ["{{trigger.payload.<field>}}", "A field another app sent"],
  ["{{steps.<id>.text}}", "Text an AI step wrote"],
  ["| date, | time, | datetime", "Format a date"],
  ["| add_days:2, | add_hours:-1", "Move a date"],
  ['| default:"there"', "Used when the field is empty"],
] as const;

/** A step id not used yet in the workflow. */
export function newStepId(type: string, steps: Step[]): string {
  const taken = new Set<string>();
  const visit = (list: Step[]) => {
    for (const step of list) {
      taken.add(step.id);
      if (Array.isArray(step.if_true)) visit(step.if_true as Step[]);
      if (Array.isArray(step.if_false)) visit(step.if_false as Step[]);
    }
  };
  visit(steps);
  for (let index = 1; ; index++) {
    const id = `${type}_${index}`;
    if (!taken.has(id)) return id;
  }
}
