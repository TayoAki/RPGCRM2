import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  pgSchema,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../db/schema";

/**
 * The CRM's records, in their own `crm` schema with their own migrations (drizzle-crm/), so upstream
 * OpenDuet migrations never have to merge with ours.
 *
 * Tables, columns and views follow Atomic CRM's Supabase schema, which its screens are written
 * against. Keys are the snake_case column names, so a row is already the shape the screens expect.
 */
export const crm = pgSchema("crm");

// Bun's driver serialises JSON itself; see db/schema/json.ts.
const json = customType<{ data: unknown; driverData: unknown }>({
  dataType: () => "jsonb",
  toDriver: (value) => value,
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const id = () =>
  bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity();
const reference = () => bigint({ mode: "number" });
// ISO 8601 out, as PostgREST answered the screens. Drizzle's string mode gives "2026-01-15 00:00:00+00",
// a format browsers aren't required to parse.
const moment = customType<{ data: string; driverData: Date | string }>({
  dataType: () => "timestamp with time zone",
  fromDriver: (value) => new Date(value).toISOString(),
});
const now = sql`now()`;
const createdAt = () => moment().notNull().default(now);
// Kept by the touch_updated_at trigger, whoever writes.
const updatedAt = () => moment().notNull().default(now);
const customFields = () => json().notNull().default({});
const cascade = { onDelete: "cascade", onUpdate: "cascade" } as const;
const setNull = { onDelete: "set null", onUpdate: "cascade" } as const;

export const sales = crm.table(
  "sales",
  {
    id: id(),
    user_id: text().references(() => users.id, { onDelete: "set null" }),
    first_name: text().notNull(),
    last_name: text().notNull().default(""),
    email: text().notNull(),
    administrator: boolean().notNull().default(false),
    avatar: json(),
    disabled: boolean().notNull().default(false),
    secondary_emails: json().notNull().default([]),
  },
  (table) => [uniqueIndex("sales_user_id_idx").on(table.user_id)],
);

export const companies = crm.table("companies", {
  id: id(),
  created_at: createdAt(),
  name: text().notNull(),
  sector: text(),
  size: smallint(),
  linkedin_url: text(),
  website: text(),
  phone_number: text(),
  address: text(),
  zipcode: text(),
  city: text(),
  state_abbr: text(),
  sales_id: reference().references(() => sales.id),
  context_links: json(),
  country: text(),
  description: text(),
  revenue: text(),
  tax_identifier: text(),
  logo: json(),
  updated_at: updatedAt(),
  lifecycle_stage: text().notNull().default("lead"),
  lead_source: text(),
  custom_fields: customFields(),
});

export const contacts = crm.table(
  "contacts",
  {
    id: id(),
    first_name: text(),
    last_name: text(),
    gender: text(),
    title: text(),
    background: text(),
    avatar: json(),
    // Defaults for contacts made outside the form (the API, the agent); the form sets both.
    first_seen: moment().default(now),
    last_seen: moment().default(now),
    has_newsletter: boolean(),
    status: text(),
    // The tag screens and the export read it as an array.
    tags: bigint({ mode: "number" }).array().notNull().default(sql`'{}'`),
    company_id: reference().references(() => companies.id, cascade),
    sales_id: reference().references(() => sales.id),
    linkedin_url: text(),
    email_jsonb: json(),
    phone_jsonb: json(),
    updated_at: updatedAt(),
    lifecycle_stage: text().notNull().default("lead"),
    lead_source: text(),
    // Campaign, referrer or UTM tags, as they arrived.
    lead_source_detail: text(),
    custom_fields: customFields(),
  },
  (table) => [index("contacts_company_id_idx").on(table.company_id)],
);

export const contactNotes = crm.table(
  "contact_notes",
  {
    id: id(),
    contact_id: reference()
      .notNull()
      .references(() => contacts.id, cascade),
    text: text(),
    date: moment().default(now),
    sales_id: reference().references(() => sales.id),
    status: text(),
    attachments: json(),
    updated_at: updatedAt(),
  },
  (table) => [index("contact_notes_contact_id_idx").on(table.contact_id)],
);

export const deals = crm.table(
  "deals",
  {
    id: id(),
    name: text().notNull(),
    company_id: reference().references(() => companies.id, cascade),
    contact_ids: bigint({ mode: "number" }).array(),
    categories: text().array(),
    stage: text().notNull(),
    description: text(),
    // The deal screens format it as a number; the form requires it, imports and the agent may not set it.
    amount: bigint({ mode: "number" }).notNull().default(0),
    created_at: createdAt(),
    updated_at: createdAt(),
    archived_at: moment(),
    expected_closing_date: date({ mode: "string" }),
    sales_id: reference().references(() => sales.id),
    index: smallint(),
    lead_source: text(),
    custom_fields: customFields(),
  },
  (table) => [index("deals_company_id_idx").on(table.company_id)],
);

export const dealNotes = crm.table(
  "deal_notes",
  {
    id: id(),
    deal_id: reference()
      .notNull()
      .references(() => deals.id, cascade),
    type: text(),
    text: text(),
    date: moment().default(now),
    sales_id: reference().references(() => sales.id),
    attachments: json(),
    updated_at: updatedAt(),
  },
  (table) => [index("deal_notes_deal_id_idx").on(table.deal_id)],
);

export const tags = crm.table("tags", {
  id: id(),
  name: text().notNull(),
  color: text().notNull(),
});

export const tasks = crm.table(
  "tasks",
  {
    id: id(),
    contact_id: reference()
      .notNull()
      .references(() => contacts.id, cascade),
    type: text(),
    text: text(),
    due_date: moment(),
    done_date: moment(),
    sales_id: reference().references(() => sales.id),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [index("tasks_contact_id_idx").on(table.contact_id)],
);

// Calls and meetings: booked through a scheduling tool, or logged by hand, with how each one went.
export const meetings = crm.table(
  "meetings",
  {
    id: id(),
    title: text().notNull(),
    contact_id: reference().references(() => contacts.id, setNull),
    deal_id: reference().references(() => deals.id, setNull),
    company_id: reference().references(() => companies.id, setNull),
    start_at: moment().notNull(),
    end_at: moment(),
    location: text(),
    // scheduled, completed, no_show, canceled
    status: text().notNull().default("scheduled"),
    outcome: text(),
    outcome_notes: text(),
    // manual, calcom, calendly, webhook
    source: text().notNull().default("manual"),
    external_id: text(),
    attendees: json().notNull().default([]),
    sales_id: reference().references(() => sales.id),
    created_at: createdAt(),
    updated_at: updatedAt(),
    custom_fields: customFields(),
  },
  (table) => [
    index("meetings_contact_id_idx").on(table.contact_id),
    index("meetings_deal_id_idx").on(table.deal_id),
    index("meetings_start_at_idx").on(table.start_at),
    uniqueIndex("meetings_source_external_id_idx").on(
      table.source,
      table.external_id,
    ),
  ],
);

export const proposals = crm.table(
  "proposals",
  {
    id: id(),
    deal_id: reference()
      .notNull()
      .references(() => deals.id, cascade),
    contact_id: reference().references(() => contacts.id, setNull),
    title: text().notNull(),
    // Markdown.
    body: text().notNull().default(""),
    amount: bigint({ mode: "number" }),
    // draft, scheduled, sent, viewed, accepted, declined
    status: text().notNull().default("draft"),
    // A scheduled proposal goes out at this time.
    send_at: moment(),
    sent_at: moment(),
    viewed_at: moment(),
    accepted_at: moment(),
    declined_at: moment(),
    valid_until: date({ mode: "string" }),
    // The client's link to read and accept it, without signing in.
    token: text()
      .notNull()
      .default(
        sql`replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`,
      ),
    sales_id: reference().references(() => sales.id),
    created_at: createdAt(),
    updated_at: updatedAt(),
    custom_fields: customFields(),
  },
  (table) => [
    index("proposals_deal_id_idx").on(table.deal_id),
    uniqueIndex("proposals_token_idx").on(table.token),
  ],
);

// Mail the CRM sent or will send, and mail from contacts it read from a mailbox.
export const emails = crm.table(
  "emails",
  {
    id: id(),
    // out or in
    direction: text().notNull().default("out"),
    // draft, scheduled, sending, sent, failed; received for mail in
    status: text().notNull().default("draft"),
    from_address: text(),
    to_address: text().notNull(),
    cc: text(),
    subject: text().notNull().default(""),
    body: text().notNull().default(""),
    contact_id: reference().references(() => contacts.id, setNull),
    deal_id: reference().references(() => deals.id, setNull),
    meeting_id: reference().references(() => meetings.id, setNull),
    proposal_id: reference().references(() => proposals.id, setNull),
    workflow_run_id: reference(),
    send_at: moment(),
    sent_at: moment(),
    message_id: text(),
    in_reply_to: text(),
    error: text(),
    sales_id: reference().references(() => sales.id),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    index("emails_contact_id_idx").on(table.contact_id),
    index("emails_deal_id_idx").on(table.deal_id),
    index("emails_status_send_at_idx").on(table.status, table.send_at),
    uniqueIndex("emails_received_message_id_idx")
      .on(table.message_id)
      .where(sql`${table.direction} = 'in'`),
  ],
);

/*
 * Where the CRM sends from and reads mail: one mailbox per person, and a shared one (no sales_id)
 * for everybody without their own. SMTP and IMAP with an app password work with Gmail, Outlook and
 * most hosts. Passwords are encrypted with the deployment's KEY_ENCRYPTION_KEY.
 */
export const mailboxes = crm.table(
  "mailboxes",
  {
    id: id(),
    sales_id: reference().references(() => sales.id, cascade),
    from_name: text(),
    from_address: text().notNull(),
    smtp_host: text().notNull(),
    smtp_port: integer().notNull().default(587),
    // True for TLS from the start (port 465), false for STARTTLS.
    smtp_secure: boolean().notNull().default(false),
    smtp_user: text().notNull(),
    smtp_password: text().notNull(),
    imap_host: text(),
    imap_port: integer().notNull().default(993),
    imap_user: text(),
    imap_password: text(),
    // The highest message uid read, per mailbox folder validity.
    imap_uid_validity: text(),
    imap_last_uid: bigint({ mode: "number" }),
    imap_checked_at: moment(),
    imap_error: text(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (table) => [
    uniqueIndex("mailboxes_sales_id_idx")
      .on(table.sales_id)
      .where(sql`${table.sales_id} is not null`),
    uniqueIndex("mailboxes_shared_idx")
      .on(sql`(true)`)
      .where(sql`${table.sales_id} is null`),
  ],
);

// Every stage a deal entered, written by a trigger so the kanban, the API and the agent all count.
export const dealStageHistory = crm.table(
  "deal_stage_history",
  {
    id: id(),
    deal_id: reference()
      .notNull()
      .references(() => deals.id, cascade),
    from_stage: text(),
    to_stage: text().notNull(),
    changed_at: createdAt(),
  },
  (table) => [index("deal_stage_history_deal_id_idx").on(table.deal_id)],
);

// Attachments, logos and avatars. In Postgres like OpenDuet's own attachments: one database, one backup.
export const files = crm.table("files", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  mime_type: text().notNull(),
  size: integer().notNull(),
  content: bytea().notNull(),
  sales_id: reference().references(() => sales.id),
  created_at: createdAt(),
});

// One-time setup steps already done in this deployment, so they never undo an admin's later choices.
export const installs = crm.table("installs", {
  name: text().primaryKey(),
  installed_at: createdAt(),
});

export const configuration = crm.table("configuration", {
  id: integer().primaryKey().default(1),
  config: json().notNull().default({}),
});

/*
 * Read-only views the list and show screens query, created by drizzle-crm/0001_views_and_triggers.sql.
 * `.existing()` so drizzle-kit leaves them to that migration.
 */
export const companiesSummary = crm
  .view("companies_summary", {
    id: bigint({ mode: "number" }).notNull(),
    created_at: moment().notNull(),
    name: text().notNull(),
    sector: text(),
    size: smallint(),
    linkedin_url: text(),
    website: text(),
    phone_number: text(),
    address: text(),
    zipcode: text(),
    city: text(),
    state_abbr: text(),
    sales_id: reference(),
    context_links: json(),
    country: text(),
    description: text(),
    revenue: text(),
    tax_identifier: text(),
    logo: json(),
    updated_at: moment().notNull(),
    lifecycle_stage: text().notNull(),
    lead_source: text(),
    custom_fields: json().notNull(),
    nb_deals: integer().notNull(),
    nb_contacts: integer().notNull(),
  })
  .existing();

export const contactsSummary = crm
  .view("contacts_summary", {
    id: bigint({ mode: "number" }).notNull(),
    first_name: text(),
    last_name: text(),
    gender: text(),
    title: text(),
    background: text(),
    avatar: json(),
    first_seen: moment(),
    last_seen: moment(),
    has_newsletter: boolean(),
    status: text(),
    tags: bigint({ mode: "number" }).array(),
    company_id: reference(),
    sales_id: reference(),
    linkedin_url: text(),
    email_jsonb: json(),
    phone_jsonb: json(),
    updated_at: moment().notNull(),
    lifecycle_stage: text().notNull(),
    lead_source: text(),
    lead_source_detail: text(),
    custom_fields: json().notNull(),
    email_fts: text(),
    phone_fts: text(),
    company_name: text(),
    nb_tasks: integer().notNull(),
  })
  .existing();

export const activityLog = crm
  .view("activity_log", {
    id: text().notNull(),
    type: text().notNull(),
    date: moment(),
    company_id: reference(),
    sales_id: reference(),
    company: json(),
    contact: json(),
    deal: json(),
    contact_note: json(),
    deal_note: json(),
  })
  .existing();
