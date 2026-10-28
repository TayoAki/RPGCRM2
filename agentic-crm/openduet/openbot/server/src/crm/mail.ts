import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "../credentials";
import type { Database } from "../db/client";
import { CrmRefusal } from "./records";
import { emails, mailboxes } from "./schema";

export type Mailbox = typeof mailboxes.$inferSelect;
export type EmailRow = typeof emails.$inferSelect;

export type OutgoingMessage = {
  from: { name?: string; address: string };
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html: string;
  inReplyTo?: string;
};

export type MailTransport = {
  send: (message: OutgoingMessage) => Promise<{ messageId: string }>;
  verify: () => Promise<void>;
};

/** A mailbox's SMTP settings, decrypted, as a transport. Tests pass their own. */
export type CreateTransport = (
  mailbox: Mailbox & { smtpPassword: string },
) => MailTransport;

const smtpTransport: CreateTransport = (mailbox) => {
  const transport = nodemailer.createTransport({
    host: mailbox.smtp_host,
    port: mailbox.smtp_port,
    secure: mailbox.smtp_secure,
    auth: { user: mailbox.smtp_user, pass: mailbox.smtpPassword },
    connectionTimeout: 20_000,
    socketTimeout: 60_000,
  });
  return {
    async send(message) {
      const sent = await transport.sendMail({
        from: message.from,
        to: message.to,
        ...(message.cc ? { cc: message.cc } : {}),
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.inReplyTo
          ? { inReplyTo: message.inReplyTo, references: message.inReplyTo }
          : {}),
      });
      return { messageId: sent.messageId };
    },
    async verify() {
      await transport.verify();
    },
  };
};

const ADDRESS = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/;
const MAX_BODY = 200_000;
// A send that never reported back is given up on after this long, rather than left "sending".
const STALE_SENDING = "15 minutes";

export const isEmailAddress = (value: string) =>
  value.length <= 254 && ADDRESS.test(value);

const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

const addressList = z
  .string()
  .transform((value) =>
    value
      .split(/[,;]/)
      .map((part) => part.trim())
      .filter(Boolean),
  )
  .refine((list) => list.length > 0 && list.length <= 20, "Add a recipient.")
  .refine(
    (list) => list.every(isEmailAddress),
    "One of those isn't an email address.",
  )
  .transform((list) => list.join(", "));

export const mailboxInput = z.object({
  from_name: z.string().max(100).optional().nullable(),
  from_address: z
    .string()
    .refine(isEmailAddress, "Enter the address to send from."),
  smtp_host: z.string().min(1).max(255),
  smtp_port: z.coerce.number().int().min(1).max(65535).default(587),
  smtp_secure: z.boolean().default(false),
  smtp_user: z.string().min(1).max(255),
  // Left out to keep the saved one.
  smtp_password: z.string().max(1000).optional(),
  imap_host: z.string().max(255).optional().nullable(),
  imap_port: z.coerce.number().int().min(1).max(65535).default(993),
  imap_user: z.string().max(255).optional().nullable(),
  imap_password: z.string().max(1000).optional(),
});

export const composeInput = z.object({
  to_address: addressList,
  cc: addressList.optional().nullable(),
  subject: z.string().max(500).transform(oneLine),
  body: z.string().max(MAX_BODY),
  contact_id: z.number().int().optional().nullable(),
  deal_id: z.number().int().optional().nullable(),
  meeting_id: z.number().int().optional().nullable(),
  proposal_id: z.number().int().optional().nullable(),
  send_at: z.iso.datetime({ offset: true }).optional().nullable(),
  draft: z.boolean().optional(),
});
export type ComposeInput = z.input<typeof composeInput>;

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );

/** Plain text as a simple HTML email: paragraphs, line breaks and links. */
export function textToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) =>
      escapeHtml(paragraph.trim())
        .replace(
          /https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
          (url) => `<a href="${url}">${url}</a>`,
        )
        .replace(/\n/g, "<br>"),
    )
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph}</p>`);
  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${paragraphs.join("")}</div>`;
}

/** What the screens may see of a mailbox: never its passwords. */
export function publicMailbox(mailbox: Mailbox) {
  const { smtp_password, imap_password, ...rest } = mailbox;
  return {
    ...rest,
    has_smtp_password: Boolean(smtp_password),
    has_imap_password: Boolean(imap_password),
  };
}

/**
 * The CRM's mail: mailboxes, and sending what people and automations write. Every message is a row in
 * crm.emails first, so a person sees what went out, what is waiting and what failed, and why.
 */
export function createCrmMail(deps: {
  database: Database;
  encryptionKey: string;
  createTransport?: CreateTransport;
}) {
  const { database, encryptionKey } = deps;
  const createTransport = deps.createTransport ?? smtpTransport;

  const decrypt = (value: string) => decryptSecret(encryptionKey, value);

  const ownMailbox = async (salesId: number | null) => {
    const [found] = await database
      .select()
      .from(mailboxes)
      .where(
        salesId === null
          ? isNull(mailboxes.sales_id)
          : eq(mailboxes.sales_id, salesId),
      )
      .limit(1);
    return found;
  };

  // A person's own mailbox, or the shared one.
  const sendingMailbox = async (salesId: number | null) =>
    (salesId === null ? undefined : await ownMailbox(salesId)) ??
    (await ownMailbox(null));

  const transportFor = async (mailbox: Mailbox) =>
    createTransport({
      ...mailbox,
      smtpPassword: await decrypt(mailbox.smtp_password),
    });

  const finish = (id: number, values: Partial<EmailRow>) =>
    database.update(emails).set(values).where(eq(emails.id, id));

  /** Sends one email row that is waiting, once: a row another sender took is left alone. */
  async function deliver(id: number): Promise<EmailRow> {
    const [claimed] = await database
      .update(emails)
      .set({ status: "sending", error: null })
      .where(
        and(
          eq(emails.id, id),
          inArray(emails.status, ["draft", "scheduled", "failed"]),
        ),
      )
      .returning();
    if (!claimed) throw new CrmRefusal("That email was already sent.", 400);
    const mailbox = await sendingMailbox(claimed.sales_id);
    if (!mailbox) {
      await finish(id, {
        status: "failed",
        error: "No mailbox is connected. Add one in the CRM's settings.",
      });
    } else {
      try {
        const transport = await transportFor(mailbox);
        const { messageId } = await transport.send({
          from: {
            ...(mailbox.from_name ? { name: mailbox.from_name } : {}),
            address: mailbox.from_address,
          },
          to: claimed.to_address,
          ...(claimed.cc ? { cc: claimed.cc } : {}),
          subject: claimed.subject,
          text: claimed.body,
          html: textToHtml(claimed.body),
          ...(claimed.in_reply_to ? { inReplyTo: claimed.in_reply_to } : {}),
        });
        await finish(id, {
          status: "sent",
          sent_at: new Date().toISOString(),
          from_address: mailbox.from_address,
          message_id: messageId,
        });
      } catch (error) {
        await finish(id, {
          status: "failed",
          from_address: mailbox.from_address,
          error: (error instanceof Error ? error.message : String(error)).slice(
            0,
            500,
          ),
        });
      }
    }
    const [row] = await database.select().from(emails).where(eq(emails.id, id));
    if (!row) throw new CrmRefusal("Not found.", 404);
    return row;
  }

  return {
    async mailboxesFor(salesId: number) {
      const [own, shared] = await Promise.all([
        ownMailbox(salesId),
        ownMailbox(null),
      ]);
      return {
        mine: own ? publicMailbox(own) : null,
        shared: shared ? publicMailbox(shared) : null,
      };
    },

    async saveMailbox(salesId: number | null, body: unknown) {
      const input = mailboxInput.parse(body);
      const existing = await ownMailbox(salesId);
      const smtpPassword = input.smtp_password
        ? await encryptSecret(encryptionKey, input.smtp_password)
        : existing?.smtp_password;
      if (!smtpPassword) {
        throw new CrmRefusal("Enter the SMTP password.", 400);
      }
      const imapPassword = input.imap_password
        ? await encryptSecret(encryptionKey, input.imap_password)
        : (existing?.imap_password ?? null);
      const values = {
        sales_id: salesId,
        from_name: input.from_name?.trim() || null,
        from_address: input.from_address.trim().toLowerCase(),
        smtp_host: input.smtp_host.trim(),
        smtp_port: input.smtp_port,
        smtp_secure: input.smtp_secure,
        smtp_user: input.smtp_user.trim(),
        smtp_password: smtpPassword,
        imap_host: input.imap_host?.trim() || null,
        imap_port: input.imap_port,
        imap_user: input.imap_user?.trim() || null,
        imap_password: imapPassword,
      };
      const [saved] = existing
        ? await database
            .update(mailboxes)
            .set(values)
            .where(eq(mailboxes.id, existing.id))
            .returning()
        : await database.insert(mailboxes).values(values).returning();
      if (!saved) throw new Error("Could not save the mailbox.");
      return publicMailbox(saved);
    },

    async removeMailbox(salesId: number | null) {
      await database
        .delete(mailboxes)
        .where(
          salesId === null
            ? isNull(mailboxes.sales_id)
            : eq(mailboxes.sales_id, salesId),
        );
    },

    /** Signs in to the mailbox's SMTP server without sending anything. */
    async testMailbox(salesId: number | null): Promise<string | null> {
      const mailbox = await ownMailbox(salesId);
      if (!mailbox) throw new CrmRefusal("Not found.", 404);
      try {
        await (await transportFor(mailbox)).verify();
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },

    /**
     * Writes an email from a CRM user: sent now, at `send_at`, or kept as a draft. A send that fails
     * is kept as failed, with the reason, and can be sent again.
     */
    async compose(
      salesId: number | null,
      body: unknown,
      extra: { workflowRunId?: number } = {},
    ): Promise<EmailRow> {
      const input = composeInput.parse(body);
      const later =
        input.send_at && Date.parse(input.send_at) > Date.now()
          ? input.send_at
          : null;
      const [row] = await database
        .insert(emails)
        .values({
          status: input.draft ? "draft" : "scheduled",
          to_address: input.to_address,
          cc: input.cc ?? null,
          subject: input.subject,
          body: input.body,
          contact_id: input.contact_id ?? null,
          deal_id: input.deal_id ?? null,
          meeting_id: input.meeting_id ?? null,
          proposal_id: input.proposal_id ?? null,
          workflow_run_id: extra.workflowRunId ?? null,
          // Now, unless later: a send interrupted here is picked up by sendDue.
          send_at: input.draft ? null : (later ?? new Date().toISOString()),
          sales_id: salesId,
        })
        .returning();
      if (!row) throw new Error("Could not save the email.");
      return input.draft || later ? row : deliver(row.id);
    },

    send: deliver,

    /** A draft or a scheduled email that hasn't gone out, removed. */
    async cancel(id: number) {
      const [removed] = await database
        .delete(emails)
        .where(
          and(
            eq(emails.id, id),
            inArray(emails.status, ["draft", "scheduled"]),
          ),
        )
        .returning({ id: emails.id });
      if (!removed) {
        throw new CrmRefusal(
          "Only drafts and scheduled emails can be removed.",
          400,
        );
      }
    },

    /** Sends what is due, and gives up on sends that never finished. */
    async sendDue(limit = 20) {
      await database
        .update(emails)
        .set({
          status: "failed",
          error:
            "Sending stopped before it finished. It may not have gone out.",
        })
        .where(
          and(
            eq(emails.status, "sending"),
            lte(emails.updated_at, sql`now() - ${STALE_SENDING}::interval`),
          ),
        );
      const due = await database
        .select({ id: emails.id })
        .from(emails)
        .where(
          and(eq(emails.status, "scheduled"), lte(emails.send_at, sql`now()`)),
        )
        .orderBy(emails.send_at)
        .limit(limit);
      for (const { id } of due) {
        await deliver(id).catch(() => undefined);
      }
      return due.length;
    },
  };
}

export type CrmMail = ReturnType<typeof createCrmMail>;
