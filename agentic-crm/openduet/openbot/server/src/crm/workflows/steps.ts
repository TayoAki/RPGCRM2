import { eq, sql } from "drizzle-orm";
import { ZodError } from "zod";
import { checkNavigationTarget } from "../../computer/target";
import type { Database } from "../../db/client";
import { NoModelKeyError, type WriteText } from "../ai";
import { type CrmMail, isEmailAddress } from "../mail";
import type { Proposals } from "../proposals";
import {
  type CrmRecords,
  CrmRefusal,
  type CrmRow,
  type ServiceActor,
} from "../records";
import { companies, contacts, emails } from "../schema";
import { groupHolds } from "./conditions";
import type { LeafStep, Step, Target, WorkflowObject } from "./definition";
import { type RenderOptions, renderText, renderValue } from "./render";
import type { RunContext, Scope } from "./scope";

type Row = Record<string, unknown>;

export type StepOutcome =
  | {
      kind: "done";
      message: string;
      output?: unknown;
      links?: RunContext["links"];
    }
  | { kind: "skipped"; message: string }
  | { kind: "wait"; until: string; message: string }
  | { kind: "branch"; branch: "if_true" | "if_false"; message: string }
  | { kind: "stop"; message: string };

/** A step that failed. Retryable ones (a mail server or the model not answering) are tried again. */
export class StepError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export const asStepError = (error: unknown): StepError => {
  if (error instanceof StepError) return error;
  if (error instanceof NoModelKeyError || error instanceof CrmRefusal) {
    return new StepError(error.message, false);
  }
  if (error instanceof ZodError) {
    return new StepError(
      error.issues[0]?.message ?? "A value doesn't fit.",
      false,
    );
  }
  const cause = (error as { cause?: Record<string, unknown> }).cause;
  const code = String(cause?.errno ?? cause?.code ?? "");
  if (code.startsWith("22") || code.startsWith("23")) {
    return new StepError(
      String(cause?.message ?? "A value doesn't fit."),
      false,
    );
  }
  return new StepError(
    error instanceof Error ? error.message : String(error),
    true,
  );
};

export type AgentTaskStarter = (
  ownerUserId: string,
  task: { title: string; instruction: string },
) => Promise<{ id: string }>;

export type StepDeps = {
  database: Database;
  records: CrmRecords;
  mail: CrmMail;
  proposals: Proposals;
  writeText?: WriteText;
  startAgentTask?: AgentTaskStarter;
  fetchImpl?: typeof fetch;
  allowPrivateHosts?: boolean;
};

export type StepRun = {
  step: Step;
  scope: Scope;
  options: RenderOptions & { title: string };
  actor: ServiceActor;
  workflow: { id: number; name: string; ownerUserId: string | null };
  runId: number;
  // What this step saved on an earlier attempt, and a way to save before an outside effect.
  previous: unknown;
  remember: (output: unknown) => Promise<void>;
};

const OBJECT_OF: Record<
  Exclude<Target, "record" | "contacts">,
  WorkflowObject
> = {
  contact: "contacts",
  company: "companies",
  deal: "deals",
  meeting: "meetings",
  proposal: "proposals",
};

const MAX_HTTP_BODY = 50_000;
const HTTP_TIMEOUT_MS = 15_000;

function targets(
  target: Target,
  scope: Scope,
): { object: WorkflowObject; row: Row }[] {
  if (target === "record") {
    const object = scope.trigger.object as WorkflowObject | undefined;
    return object && scope.record ? [{ object, row: scope.record }] : [];
  }
  if (target === "contacts") {
    return (scope.contacts ?? []).map((row) => ({ object: "contacts", row }));
  }
  const row = scope[target] as Row | undefined;
  return row ? [{ object: OBJECT_OF[target], row }] : [];
}

const linksFor = (
  object: string,
  row: CrmRow | undefined,
): RunContext["links"] => {
  const id = Number(row?.id);
  if (!row || !Number.isFinite(id)) return {};
  if (object === "contacts") return { contact_id: id };
  if (object === "deals") return { deal_id: id };
  if (object === "proposals") return { proposal_id: id };
  return {};
};

// The facts an AI step is given about the run's records, compactly.
function facts(scope: Scope): string {
  const pick = (row: Row | undefined, keys: string[]) =>
    row
      ? Object.fromEntries(
          keys
            .filter((key) => row[key] != null && row[key] !== "")
            .map((key) => [key, row[key]]),
        )
      : undefined;
  return JSON.stringify(
    {
      contact: pick(scope.contact, [
        "name",
        "title",
        "email",
        "lifecycle_stage",
        "background",
      ]),
      company: pick(scope.company, [
        "name",
        "sector",
        "website",
        "description",
      ]),
      deal: pick(scope.deal, [
        "name",
        "stage",
        "amount",
        "description",
        "expected_closing_date",
      ]),
      meeting: pick(scope.meeting, [
        "title",
        "start_at",
        "status",
        "outcome",
        "outcome_notes",
        "location",
      ]),
      proposal: pick(scope.proposal, [
        "title",
        "status",
        "url",
        "sent_at",
        "amount",
      ]),
      sender: pick(scope.owner, ["name", "email"]),
    },
    null,
    1,
  );
}

async function findContactByEmail(database: Database, email: string) {
  const [row] = await database
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      sql`exists (select 1 from jsonb_array_elements(coalesce(${contacts.email_jsonb}, '[]'::jsonb)) entry where lower(entry->>'email') = ${email})`,
    )
    .limit(1);
  return row?.id;
}

async function findOrCreateCompany(
  deps: StepDeps,
  actor: ServiceActor,
  name: string,
) {
  const [found] = await deps.database
    .select({ id: companies.id })
    .from(companies)
    .where(sql`lower(${companies.name}) = ${name.toLowerCase()}`)
    .limit(1);
  if (found) return found.id;
  const created = await deps.records.create(actor, "companies", { name });
  return Number(created?.id);
}

type Executor<TStep extends LeafStep> = (
  step: TStep,
  run: StepRun,
  deps: StepDeps,
) => Promise<StepOutcome>;

const render = (template: string, run: StepRun) =>
  renderText(template, run.scope, run.options);

const EXECUTORS: {
  [TType in LeafStep["type"]]: Executor<Extract<LeafStep, { type: TType }>>;
} = {
  async update_record(step, run, deps) {
    const rows = targets(step.target, run.scope);
    if (rows.length === 0)
      return { kind: "skipped", message: `No ${step.target} to update.` };
    const values = renderValue(step.values, run.scope, run.options) as Row;
    for (const { object, row } of rows) {
      await deps.records.update(run.actor, object, Number(row.id), values);
    }
    return {
      kind: "done",
      message: `Updated ${rows.length === 1 ? `the ${step.target}` : `${rows.length} ${step.target}`}.`,
    };
  },

  async create_record(step, run, deps) {
    const values = renderValue(step.values, run.scope, run.options) as Row;
    const created = await deps.records.create(run.actor, step.object, values);
    return {
      kind: "done",
      message: `Created a record in ${step.object}.`,
      output: { id: created?.id },
      links: linksFor(step.object, created),
    };
  },

  async delete_record(step, run, deps) {
    const rows = targets(step.target, run.scope);
    if (rows.length === 0)
      return { kind: "skipped", message: `No ${step.target} to delete.` };
    for (const { object, row } of rows) {
      await deps.records.remove(run.actor, object, Number(row.id));
    }
    return { kind: "done", message: `Deleted the ${step.target}.` };
  },

  async upsert_contact(step, run, deps) {
    const email = render(step.email, run).trim().toLowerCase();
    if (!isEmailAddress(email)) {
      return { kind: "skipped", message: `"${email}" isn't an email address.` };
    }
    const field = (template: string | undefined) => {
      const value = template ? render(template, run).trim() : "";
      return value || undefined;
    };
    const values: Row = {
      first_name: field(step.first_name),
      last_name: field(step.last_name),
      lead_source: field(step.lead_source),
      lead_source_detail: field(step.lead_source_detail),
    };
    const phone = field(step.phone);
    const companyName = field(step.company_name);
    const existing = await findContactByEmail(deps.database, email);
    if (existing) {
      const current = (await deps.records.get("contacts", existing)) ?? {};
      // Fills what is missing; never overwrites what a person entered.
      const missing = Object.fromEntries(
        Object.entries(values).filter(([key, value]) => value && !current[key]),
      );
      if (Object.keys(missing).length) {
        await deps.records.update(run.actor, "contacts", existing, missing);
      }
      return {
        kind: "done",
        message: `Found the contact ${email}.`,
        output: { id: existing, created: false },
        links: { contact_id: existing },
      };
    }
    const created = await deps.records.create(run.actor, "contacts", {
      ...Object.fromEntries(
        Object.entries(values).filter(([, value]) => value),
      ),
      first_name: values.first_name ?? email.split("@")[0],
      email_jsonb: [{ email, type: "Work" }],
      ...(phone ? { phone_jsonb: [{ number: phone, type: "Work" }] } : {}),
      ...(companyName
        ? {
            company_id: await findOrCreateCompany(deps, run.actor, companyName),
          }
        : {}),
    });
    const id = Number(created?.id);
    return {
      kind: "done",
      message: `Added the contact ${email}.`,
      output: { id, created: true },
      links: { contact_id: id },
    };
  },

  async create_task(step, run, deps) {
    const contact = run.scope.contact;
    if (!contact)
      return { kind: "skipped", message: "No contact to give the task to." };
    const due = new Date(
      Date.now() + step.due_in_days * 86_400_000,
    ).toISOString();
    const created = await deps.records.create(run.actor, "tasks", {
      contact_id: contact.id,
      text: render(step.text, run),
      type: step.task_type ?? "follow-up",
      due_date: due,
      sales_id: run.scope.owner?.id ?? contact.sales_id ?? null,
    });
    return {
      kind: "done",
      message: "Added a task.",
      output: { id: created?.id },
    };
  },

  async add_note(step, run, deps) {
    const text = render(step.text, run);
    if (step.target === "contact") {
      if (!run.scope.contact)
        return { kind: "skipped", message: "No contact for the note." };
      await deps.records.create(run.actor, "contact_notes", {
        contact_id: run.scope.contact.id,
        text,
      });
    } else {
      if (!run.scope.deal)
        return { kind: "skipped", message: "No deal for the note." };
      await deps.records.create(run.actor, "deal_notes", {
        deal_id: run.scope.deal.id,
        text,
      });
    }
    return { kind: "done", message: `Added a note to the ${step.target}.` };
  },

  async send_email(step, run, deps) {
    const saved = run.previous as { email_id?: number } | undefined;
    let emailId = saved?.email_id;
    if (!emailId) {
      const to = render(step.to, run).trim();
      if (!to)
        return {
          kind: "skipped",
          message: "Nobody to send to: the contact has no email.",
        };
      let body = render(step.body, run);
      if (step.ai_instructions) {
        if (!deps.writeText) throw new NoModelKeyError();
        body = await deps.writeText({
          system: [
            `You write short, warm, professional business emails for ${run.options.title || "a small business"}.`,
            `Write as ${String(run.scope.owner?.name ?? "the sender")}. Plain text: no subject line, no Markdown, no placeholders.`,
            "Use only the facts given. Return only the email's body, signed with the sender's first name.",
          ].join(" "),
          prompt: `Instructions: ${render(step.ai_instructions, run)}\n\nStarting point:\n${body}\n\nFacts:\n${facts(run.scope)}`,
        });
      }
      const draft = await deps.mail.compose(
        (run.scope.owner?.id as number | undefined) ?? null,
        {
          to_address: to,
          subject: render(step.subject, run),
          body,
          contact_id: (run.scope.contact?.id as number | undefined) ?? null,
          deal_id: (run.scope.deal?.id as number | undefined) ?? null,
          meeting_id: (run.scope.meeting?.id as number | undefined) ?? null,
          proposal_id: (run.scope.proposal?.id as number | undefined) ?? null,
          draft: true,
        },
        { workflowRunId: run.runId },
      );
      emailId = draft.id;
      await run.remember({ email_id: emailId });
      if (step.review_first) {
        if (run.scope.contact) {
          await deps.records.create(run.actor, "tasks", {
            contact_id: run.scope.contact.id,
            text: `Read and send the email "${draft.subject}" (written by the automation "${run.workflow.name}")`,
            type: "email",
            due_date: new Date().toISOString(),
            sales_id: run.scope.owner?.id ?? null,
          });
        }
        return {
          kind: "done",
          message: `Wrote an email to ${to} for review.`,
          output: { email_id: emailId },
        };
      }
    } else if (step.review_first) {
      return {
        kind: "done",
        message: "The email is waiting for review.",
        output: saved,
      };
    }
    const [current] = await deps.database
      .select()
      .from(emails)
      .where(eq(emails.id, emailId));
    if (current?.status === "sent") {
      return {
        kind: "done",
        message: "The email was sent.",
        output: { email_id: emailId },
      };
    }
    const sent = await deps.mail.send(emailId);
    if (sent.status !== "sent")
      throw new StepError(sent.error ?? "The email wasn't sent.", true);
    return {
      kind: "done",
      message: `Emailed ${sent.to_address}.`,
      output: { email_id: emailId },
    };
  },

  async ai_write(step, run, deps) {
    if (!deps.writeText) throw new NoModelKeyError();
    const text = await deps.writeText({
      system:
        "You help a small business with its CRM. Answer with only the text asked for, no preamble.",
      prompt: `${render(step.prompt, run)}\n\nFacts:\n${facts(run.scope)}`,
    });
    return { kind: "done", message: "Wrote the text.", output: { text } };
  },

  async ai_agent(step, run, deps) {
    if (!deps.startAgentTask) {
      throw new StepError("No Bot is available to take this on.", false);
    }
    const ownerUserId =
      (run.scope.owner?.user_id as string | null | undefined) ??
      run.workflow.ownerUserId;
    if (!ownerUserId) {
      return {
        kind: "skipped",
        message: "Nobody to start the Bot's task for.",
      };
    }
    const about = (["deal", "contact", "company"] as const)
      .map((key) => ({ key, row: run.scope[key] }))
      .find(({ row }) => row);
    const instruction = [
      render(step.instructions, run),
      about
        ? `This is about the CRM ${about.key} "${String(about.row?.name ?? "")}" (${OBJECT_OF[about.key]} id ${String(about.row?.id)}). Read it with the CRM tools before acting on it.`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const task = await deps.startAgentTask(ownerUserId, {
      title: `${run.workflow.name}`.slice(0, 160),
      instruction,
    });
    return {
      kind: "done",
      message: "Started a task for the Bot.",
      output: { task_id: task.id },
    };
  },

  async generate_proposal(step, run, deps) {
    if (!run.scope.deal)
      return { kind: "skipped", message: "No deal to write a proposal for." };
    const proposal = await deps.proposals.generate(
      run.actor,
      Number(run.scope.deal.id),
      step.instructions ? render(step.instructions, run) : "",
    );
    return {
      kind: "done",
      message: `Wrote the proposal "${String(proposal.title)}".`,
      output: {
        proposal_id: proposal.id,
        url: deps.proposals.urlOf(proposal.token),
      },
      links: { proposal_id: Number(proposal.id) },
    };
  },

  async send_proposal(step, run, deps) {
    const proposal = run.scope.proposal;
    if (!proposal) return { kind: "skipped", message: "No proposal to send." };
    if (
      ["sent", "viewed", "accepted", "declined"].includes(
        String(proposal.status),
      )
    ) {
      return { kind: "skipped", message: "The proposal was already sent." };
    }
    const email = await deps.proposals.send(run.actor, Number(proposal.id), {
      subject: render(step.subject, run),
      body: render(step.body, run),
    });
    if (email.status !== "sent")
      throw new StepError(email.error ?? "The proposal wasn't sent.", true);
    return {
      kind: "done",
      message: `Sent the proposal to ${email.to_address}.`,
    };
  },

  async delay(step, run) {
    let until: number;
    if (step.until) {
      until = Date.parse(render(step.until, run));
      if (Number.isNaN(until)) {
        return { kind: "skipped", message: "The time to wait for isn't set." };
      }
    } else {
      const unit = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 }[
        step.unit
      ];
      until = Date.now() + step.amount * unit;
    }
    if (until <= Date.now())
      return { kind: "done", message: "No need to wait." };
    return {
      kind: "wait",
      until: new Date(until).toISOString(),
      message: `Waiting until ${new Date(until).toISOString()}.`,
    };
  },

  async stop() {
    return { kind: "stop", message: "Stopped." };
  },

  async http_request(step, run, deps) {
    const verdict = checkNavigationTarget(render(step.url, run), {
      allowPrivateHosts: deps.allowPrivateHosts,
    });
    if (!verdict.allowed) throw new StepError(verdict.reason, false);
    const response = await (deps.fetchImpl ?? fetch)(verdict.url, {
      method: step.method,
      headers: Object.fromEntries(
        Object.entries(step.headers).map(([key, value]) => [
          key,
          render(value, run),
        ]),
      ),
      ...(step.body && step.method !== "GET"
        ? { body: render(step.body, run) }
        : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const text = (await response.text()).slice(0, MAX_HTTP_BODY);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (response.status >= 500) {
      throw new StepError(`The address answered ${response.status}.`, true);
    }
    return {
      kind: "done",
      message: `The address answered ${response.status}.`,
      output: { status: response.status, body: text, json },
    };
  },
};

export async function executeStep(
  run: StepRun,
  deps: StepDeps,
): Promise<StepOutcome> {
  const { step } = run;
  if (step.type === "if") {
    const holds = groupHolds(
      step.when,
      run.scope as unknown as Row,
      run.options,
    );
    return {
      kind: "branch",
      branch: holds ? "if_true" : "if_false",
      message: holds ? "The condition held." : "The condition didn't hold.",
    };
  }
  const execute = EXECUTORS[step.type] as Executor<LeafStep>;
  return execute(step, run, deps);
}
