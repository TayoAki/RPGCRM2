import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { NoModelKeyError, type WriteText } from "./ai";
import type { CrmMail } from "./mail";
import {
  type CrmActor,
  type CrmRecords,
  CrmRefusal,
  type CrmRow,
} from "./records";
import {
  companies,
  configuration,
  contactNotes,
  contacts,
  dealNotes,
  deals,
  meetings,
  proposals,
  sales,
} from "./schema";

type Row = Record<string, unknown>;

const DEFAULT_EMAIL_SUBJECT = "Your proposal: {title}";
const DEFAULT_EMAIL_BODY = `Hi {first_name},

Thanks again for your time. Here is the proposal we talked about:

{url}

You can read it and accept it from that page. Let me know if you have any questions.

{sender}`;

const NOTES_FOR_CONTEXT = 15;

const firstEmail = (row: Row | undefined) => {
  const list = row?.email_jsonb;
  return Array.isArray(list)
    ? ((list[0] as Row | undefined)?.email as string | undefined)
    : undefined;
};

const lines = (entries: [string, unknown][]) =>
  entries
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(([label, value]) => `${label}: ${String(value)}`)
    .join("\n");

/**
 * Proposals: drafted by the model from what the CRM knows about the deal, sent from the owner's
 * mailbox as a private link, and read, accepted or declined by the client on that link.
 */
export function createProposals(deps: {
  database: Database;
  records: CrmRecords;
  mail: CrmMail;
  publicUrl: string;
  writeText?: WriteText;
}) {
  const { database, records, mail } = deps;

  const settings = async () => {
    const [row] = await database.select().from(configuration).limit(1);
    return (row?.config ?? {}) as Row;
  };

  const urlOf = (token: unknown) => `${deps.publicUrl}/proposal/${token}`;

  async function dealContext(dealId: number) {
    const [deal] = await database
      .select()
      .from(deals)
      .where(eq(deals.id, dealId));
    if (!deal) throw new CrmRefusal("That deal doesn't exist.", 404);
    const contactIds = deal.contact_ids ?? [];
    const [company] = deal.company_id
      ? await database
          .select()
          .from(companies)
          .where(eq(companies.id, deal.company_id))
      : [];
    const people = contactIds.length
      ? await database
          .select()
          .from(contacts)
          .where(inArray(contacts.id, contactIds))
      : [];
    const notes = await database
      .select({ text: dealNotes.text, date: dealNotes.date })
      .from(dealNotes)
      .where(eq(dealNotes.deal_id, dealId))
      .orderBy(desc(dealNotes.date))
      .limit(NOTES_FOR_CONTEXT);
    const personNotes = contactIds.length
      ? await database
          .select({ text: contactNotes.text, date: contactNotes.date })
          .from(contactNotes)
          .where(inArray(contactNotes.contact_id, contactIds))
          .orderBy(desc(contactNotes.date))
          .limit(NOTES_FOR_CONTEXT)
      : [];
    const calls = await database
      .select()
      .from(meetings)
      .where(
        or(
          eq(meetings.deal_id, dealId),
          contactIds.length
            ? inArray(meetings.contact_id, contactIds)
            : sql`false`,
        ),
      )
      .orderBy(desc(meetings.start_at))
      .limit(5);
    return { deal, company, people, notes: [...notes, ...personNotes], calls };
  }

  return {
    urlOf,

    /** A draft proposal for a deal, written by the model. Saved as a draft for a person to read. */
    async generate(
      actor: CrmActor,
      dealId: number,
      instructions = "",
    ): Promise<CrmRow> {
      if (!deps.writeText) throw new NoModelKeyError();
      const config = await settings();
      const { deal, company, people, notes, calls } = await dealContext(dealId);
      const contact = people[0];
      const prompt = [
        "Write a proposal for this deal.",
        `Deal:\n${lines([
          ["Name", deal.name],
          [
            "Amount",
            deal.amount ? `${deal.amount} ${config.currency ?? "USD"}` : null,
          ],
          ["Categories", deal.categories?.join(", ")],
          ["Description", deal.description],
          ["Expected closing date", deal.expected_closing_date],
        ])}`,
        company
          ? `Client company:\n${lines([
              ["Name", company.name],
              ["Sector", company.sector],
              ["Website", company.website],
              ["Description", company.description],
            ])}`
          : "",
        people.length
          ? `People:\n${people
              .map(
                (person) =>
                  `- ${[person.first_name, person.last_name].join(" ")}${person.title ? `, ${person.title}` : ""}`,
              )
              .join("\n")}`
          : "",
        calls.length
          ? `Calls:\n${calls
              .map(
                (call) =>
                  `- ${call.start_at.slice(0, 10)} ${call.title}: ${call.status}${call.outcome ? `, outcome "${call.outcome}"` : ""}${call.outcome_notes ? `. Notes: ${call.outcome_notes}` : ""}`,
              )
              .join("\n")}`
          : "",
        notes.length
          ? `Notes, newest first:\n${notes
              .map(
                (note) =>
                  `- ${String(note.date ?? "").slice(0, 10)} ${note.text ?? ""}`,
              )
              .join("\n")}`
          : "",
        config.proposalTemplate
          ? `Follow this structure and wording where it fits:\n${String(config.proposalTemplate)}`
          : "",
        instructions ? `Also: ${instructions}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const body = await deps.writeText({
        system: [
          `You write sales proposals for ${String(config.businessName || config.title || "our business")}.`,
          config.businessDescription
            ? `What we offer: ${String(config.businessDescription)}`
            : "",
          "Write in Markdown with short sections: the client's situation, what we propose, deliverables, timeline, price, next steps.",
          "Use only the facts given. Where something is missing, write a placeholder in [square brackets] for a person to fill in. Don't invent prices, dates or names.",
          "Return only the proposal.",
        ]
          .filter(Boolean)
          .join(" "),
        prompt,
      });
      const title = `Proposal: ${company?.name ?? deal.name}`;
      const created = await records.create(actor, "proposals", {
        deal_id: deal.id,
        contact_id: contact?.id ?? null,
        title,
        body,
        amount: deal.amount || null,
        sales_id: deal.sales_id,
      });
      if (!created) throw new Error("Could not save the proposal.");
      return created;
    },

    /**
     * Emails a proposal's link to its contact from the owner's mailbox, now or at `sendAt`. The
     * proposal is marked sent when the email goes out.
     */
    async send(
      actor: CrmActor,
      proposalId: number,
      options: { subject?: string; body?: string; sendAt?: string | null } = {},
    ) {
      const [proposal] = await database
        .select()
        .from(proposals)
        .where(eq(proposals.id, proposalId));
      if (!proposal) throw new CrmRefusal("Not found.", 404);
      if (proposal.status === "accepted" || proposal.status === "declined") {
        throw new CrmRefusal("That proposal has been answered already.", 400);
      }
      const [deal] = await database
        .select()
        .from(deals)
        .where(eq(deals.id, proposal.deal_id));
      const contactId = proposal.contact_id ?? deal?.contact_ids?.[0];
      const [contact] = contactId
        ? await database
            .select()
            .from(contacts)
            .where(eq(contacts.id, contactId))
        : [];
      const to = firstEmail(contact);
      if (!to) {
        throw new CrmRefusal(
          "The proposal's contact has no email address.",
          400,
        );
      }
      const [owner] = proposal.sales_id
        ? await database
            .select()
            .from(sales)
            .where(eq(sales.id, proposal.sales_id))
        : [];
      const config = await settings();
      const fill = (text: string) =>
        text
          .replaceAll("{title}", proposal.title)
          .replaceAll("{first_name}", contact?.first_name ?? "there")
          .replaceAll("{url}", urlOf(proposal.token))
          .replaceAll(
            "{sender}",
            owner ? `${owner.first_name} ${owner.last_name}`.trim() : "",
          );
      const later =
        options.sendAt && Date.parse(options.sendAt) > Date.now()
          ? options.sendAt
          : null;
      const email = await mail.compose(proposal.sales_id, {
        to_address: to,
        subject: fill(
          options.subject ??
            String(config.proposalEmailSubject || DEFAULT_EMAIL_SUBJECT),
        ),
        body: fill(
          options.body ??
            String(config.proposalEmailBody || DEFAULT_EMAIL_BODY),
        ),
        contact_id: contact?.id ?? null,
        deal_id: proposal.deal_id,
        proposal_id: proposal.id,
        send_at: later,
      });
      await records.update(actor, "proposals", proposal.id, {
        contact_id: contact?.id ?? null,
        ...(later
          ? { status: "scheduled", send_at: later }
          : email.status === "sent"
            ? { status: "sent", sent_at: email.sent_at, send_at: null }
            : {}),
      });
      return email;
    },

    /** Marks scheduled proposals sent once their email has gone out. */
    async markSent() {
      await database.execute(sql`
        update ${proposals} p set status = 'sent', sent_at = e.sent_at
        from crm.emails e
        where e.proposal_id = p.id and e.status = 'sent' and p.status = 'scheduled'
      `);
    },

    /** What the client sees on their link. Opening it the first time marks the proposal viewed. */
    async view(token: string) {
      const [proposal] = await database
        .select()
        .from(proposals)
        .where(eq(proposals.token, token));
      if (!proposal || proposal.status === "draft") return null;
      if (proposal.status === "sent") {
        await records.update(
          { service: "proposal-link", salesId: proposal.sales_id },
          "proposals",
          proposal.id,
          { status: "viewed", viewed_at: new Date().toISOString() },
        );
      }
      const [deal] = await database
        .select()
        .from(deals)
        .where(eq(deals.id, proposal.deal_id));
      const [company] = deal?.company_id
        ? await database
            .select()
            .from(companies)
            .where(eq(companies.id, deal.company_id))
        : [];
      const [owner] = proposal.sales_id
        ? await database
            .select()
            .from(sales)
            .where(eq(sales.id, proposal.sales_id))
        : [];
      const config = await settings();
      return {
        title: proposal.title,
        body: proposal.body,
        amount: proposal.amount,
        currency: (config.currency as string) ?? "USD",
        status: proposal.status === "sent" ? "viewed" : proposal.status,
        valid_until: proposal.valid_until,
        accepted_at: proposal.accepted_at,
        declined_at: proposal.declined_at,
        client: company?.name ?? null,
        from: {
          name: owner ? `${owner.first_name} ${owner.last_name}`.trim() : null,
          business:
            (config.businessName as string) || (config.title as string) || null,
        },
      };
    },

    /** The client's answer, once. */
    async answer(
      token: string,
      answer: "accepted" | "declined",
      by: { name?: string; reason?: string },
    ) {
      const [proposal] = await database
        .select()
        .from(proposals)
        .where(
          and(
            eq(proposals.token, token),
            inArray(proposals.status, ["sent", "viewed", "scheduled"]),
          ),
        );
      if (!proposal) {
        throw new CrmRefusal("This proposal can't be answered anymore.", 400);
      }
      if (
        proposal.valid_until &&
        proposal.valid_until < new Date().toISOString().slice(0, 10)
      ) {
        throw new CrmRefusal(
          "This proposal has expired. Ask for a new one.",
          400,
        );
      }
      const actor = { service: "proposal-link", salesId: proposal.sales_id };
      const now = new Date().toISOString();
      await records.update(actor, "proposals", proposal.id, {
        status: answer,
        ...(answer === "accepted"
          ? { accepted_at: now }
          : { declined_at: now }),
      });
      const name = by.name?.trim().slice(0, 100);
      const reason = by.reason?.trim().slice(0, 2000);
      await records.create(actor, "deal_notes", {
        deal_id: proposal.deal_id,
        text:
          answer === "accepted"
            ? `${name || "The client"} accepted "${proposal.title}" from the proposal link.`
            : `${name || "The client"} declined "${proposal.title}" from the proposal link.${reason ? ` Reason: ${reason}` : ""}`,
        sales_id: proposal.sales_id,
      });
      return { status: answer };
    },
  };
}

export type Proposals = ReturnType<typeof createProposals>;
