import type { Identifier } from "ra-core";

export type Meeting = {
  id: Identifier;
  title: string;
  contact_id: Identifier | null;
  deal_id: Identifier | null;
  company_id: Identifier | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  status: "scheduled" | "completed" | "no_show" | "canceled";
  outcome: string | null;
  outcome_notes: string | null;
  source: string;
  sales_id: Identifier | null;
  updated_at: string;
};

export type Proposal = {
  id: Identifier;
  deal_id: Identifier;
  contact_id: Identifier | null;
  title: string;
  body: string;
  amount: number | null;
  status:
    | "draft"
    | "ready"
    | "scheduled"
    | "sent"
    | "viewed"
    | "accepted"
    | "declined";
  send_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  valid_until: string | null;
  token: string;
  updated_at: string;
};

export type Email = {
  id: Identifier;
  direction: "out" | "in";
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "received";
  from_address: string | null;
  to_address: string;
  subject: string;
  body: string;
  contact_id: Identifier | null;
  deal_id: Identifier | null;
  workflow_run_id: Identifier | null;
  send_at: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
};

export type Mailbox = {
  id: Identifier;
  from_name: string | null;
  from_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  imap_host: string | null;
  imap_port: number;
  imap_user: string | null;
  imap_checked_at: string | null;
  imap_error: string | null;
  has_smtp_password: boolean;
  has_imap_password: boolean;
};

export type Requirement = "mailbox" | "model" | "bot";

export type AutomationInfo = {
  booking_url: string | null;
  date_fields: Record<string, string[]>;
  meeting_outcomes: string[];
  lead_sources: string[];
  ready: Record<Requirement, boolean>;
};

export type Condition = { field: string; op: string; value?: unknown };
export type ConditionGroup = { match: "all" | "any"; conditions: Condition[] };

export type Trigger =
  | {
      type: "record";
      object: string;
      on: ("created" | "updated" | "deleted")[];
      when?: ConditionGroup;
    }
  | {
      type: "date";
      object: string;
      field: string;
      offset_minutes: number;
      when?: ConditionGroup;
    }
  | {
      type: "schedule";
      cron: string;
      timezone?: string;
      object?: string;
      when?: ConditionGroup;
    }
  | { type: "webhook" }
  | { type: "manual"; object: string };

export type Step = { id: string; type: string; [key: string]: unknown };

export type Workflow = {
  id: Identifier;
  name: string;
  description: string;
  enabled: boolean;
  trigger: Trigger;
  steps: Step[];
  version: number;
  recipe: string | null;
  needs: Requirement[];
  runs?: Partial<Record<RunStatus, number>>;
  webhook_url?: string | null;
  updated_at: string;
};

export type RunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "canceled";

export type RunLogEntry = {
  at: string;
  step: string;
  type: string;
  status: string;
  message: string;
};

export type Run = {
  id: Identifier;
  status: RunStatus;
  trigger: { object?: string; recordId?: number; action?: string };
  error: string | null;
  wake_at: string;
  created_at: string;
  finished_at: string | null;
  workflow_version: number;
  log?: RunLogEntry[];
};

export type FieldType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multi_select"
  | "email"
  | "phone"
  | "url"
  | "rating"
  | "relation";

export type Choice = { value: string; label: string; color?: string };

export type FieldDefinition = {
  id: number;
  object: string;
  name: string;
  label: string;
  type: FieldType;
  options: { choices?: Choice[]; target?: string; currency?: string };
  required: boolean;
  position: number;
  standard: boolean;
};

export type ObjectDefinition = {
  name: string;
  label_singular: string;
  label_plural: string;
  description: string;
  icon: string | null;
  standard: boolean;
  in_navigation: boolean;
};

export type Reach = "none" | "own" | "all";

export type ObjectAccess = {
  read: Reach;
  create: boolean;
  update: Reach;
  delete: Reach;
  hidden: string[];
  read_only: string[];
};

export type SavedView = {
  id: number;
  object: string;
  name: string;
  type: "table" | "kanban" | "calendar";
  config: {
    filter?: Record<string, unknown>;
    sort?: { field: string; order: "ASC" | "DESC" };
    columns?: string[];
    group_by?: string;
    date_field?: string;
  };
  shared: boolean;
  sales_id: number | null;
};

export type ObjectRule = {
  read?: Reach;
  create?: boolean;
  update?: Reach;
  delete?: Reach;
};

export type Role = {
  id: number;
  name: string;
  description: string;
  rules: {
    objects: Record<string, ObjectRule>;
    fields: Record<string, Record<string, "hidden" | "read_only">>;
  };
};

export type Aggregate = "count" | "sum" | "avg" | "min" | "max";
export type DateBucket = "day" | "week" | "month" | "quarter" | "year";

export type Widget = {
  id: string;
  title: string;
  type: "number" | "bar" | "line" | "pie" | "list";
  object: string;
  filter?: Record<string, unknown>;
  group_by?: string;
  bucket?: DateBucket;
  fn: Aggregate;
  field?: string;
  width: 1 | 2 | 3;
};

export type Dashboard = {
  id: number;
  name: string;
  widgets: Widget[];
  shared: boolean;
  sales_id: number | null;
};

export type ReportRow = { key: unknown; value: number };

export type ScimToken = {
  id: number;
  prefix: string;
  created_by: string | null;
  last_used_at: string | null;
  created_at: string;
};

export type SignInSetup = {
  auth_url: string;
  scim_url: string;
  scim_from_environment: boolean;
  scim_tokens: ScimToken[];
};

export type IdentityProvider = {
  providerId: string;
  issuer: string;
  domain: string;
  protocol: "saml" | "oidc";
  registeredBy: string | null;
};

export type ApiKey = {
  id: number;
  name: string;
  prefix: string;
  sales_id: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  owner_first_name: string;
  owner_last_name: string;
};
