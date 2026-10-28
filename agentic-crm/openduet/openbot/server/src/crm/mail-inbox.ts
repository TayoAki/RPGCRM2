import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { decryptSecret } from "../credentials";
import type { Database } from "../db/client";
import type { Mailbox } from "./mail";
import { contacts, emails, mailboxes } from "./schema";

export type InboxMessage = {
  messageId: string;
  inReplyTo?: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  date: string;
};

export type InboxBatch = {
  uidValidity: string;
  lastUid: number | null;
  messages: InboxMessage[];
};

/** New messages in a mailbox's inbox since `lastUid`, or from the last few days on a first read. */
export type ReadInbox = (
  mailbox: Mailbox & { imapPassword: string },
  since: { uidValidity: string | null; lastUid: number | null },
) => Promise<InboxBatch>;

const FIRST_READ_DAYS = 3;
const MAX_PER_READ = 200;
const MAX_TEXT = 50_000;

const imapInbox: ReadInbox = async (mailbox, since) => {
  const client = new ImapFlow({
    host: mailbox.imap_host ?? "",
    port: mailbox.imap_port,
    secure: mailbox.imap_port === 993,
    auth: { user: mailbox.imap_user ?? "", pass: mailbox.imapPassword },
    logger: false,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = client.mailbox;
      const uidValidity = String(
        status && typeof status === "object" ? status.uidValidity : "",
      );
      const fresh = since.uidValidity !== uidValidity || since.lastUid === null;
      const range = fresh
        ? {
            since: new Date(Date.now() - FIRST_READ_DAYS * 24 * 3600_000),
          }
        : { uid: `${(since.lastUid ?? 0) + 1}:*` };
      const uids = ((await client.search(range, { uid: true })) || [])
        .filter((uid) => fresh || uid > (since.lastUid ?? 0))
        .slice(-MAX_PER_READ);
      const messages: InboxMessage[] = [];
      let lastUid = fresh ? null : since.lastUid;
      for (const uid of uids) {
        const fetched = await client.fetchOne(
          String(uid),
          { source: true },
          { uid: true },
        );
        lastUid = Math.max(lastUid ?? 0, uid);
        if (!fetched?.source) continue;
        const parsed = await simpleParser(fetched.source);
        const from = parsed.from?.value[0];
        if (!from?.address || !parsed.messageId) continue;
        messages.push({
          messageId: parsed.messageId,
          ...(parsed.inReplyTo ? { inReplyTo: parsed.inReplyTo } : {}),
          from: from.address.toLowerCase(),
          ...(from.name ? { fromName: from.name } : {}),
          to: Array.isArray(parsed.to)
            ? parsed.to.map((to) => to.text).join(", ")
            : (parsed.to?.text ?? ""),
          subject: parsed.subject ?? "",
          text: (parsed.text ?? "").slice(0, MAX_TEXT),
          date: (parsed.date ?? new Date()).toISOString(),
        });
      }
      return { uidValidity, lastUid, messages };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
};

/**
 * Reads each connected mailbox's new mail and keeps what came from a CRM contact, or answers mail
 * the CRM sent, on that contact's timeline (crm.emails, direction "in"). Other mail stays in the
 * mailbox: the CRM is not an inbox.
 */
export function createCrmInbox(deps: {
  database: Database;
  encryptionKey: string;
  readInbox?: ReadInbox;
}) {
  const { database } = deps;
  const readInbox = deps.readInbox ?? imapInbox;

  async function contactsByAddress(addresses: string[]) {
    if (addresses.length === 0) return new Map<string, number>();
    const rows = await database
      .select({ id: contacts.id, email: sql<string>`lower(entry->>'email')` })
      .from(contacts)
      .innerJoin(
        sql`jsonb_array_elements(coalesce(${contacts.email_jsonb}, '[]'::jsonb)) as entry`,
        sql`true`,
      )
      .where(
        inArray(
          sql`lower(entry->>'email')`,
          addresses.map((address) => address.toLowerCase()),
        ),
      );
    return new Map(rows.map((row) => [row.email, row.id]));
  }

  async function store(mailbox: Mailbox, messages: InboxMessage[]) {
    const byAddress = await contactsByAddress(messages.map((m) => m.from));
    const replyIds = messages.flatMap((m) =>
      m.inReplyTo ? [m.inReplyTo] : [],
    );
    const answered = replyIds.length
      ? await database
          .select({
            message_id: emails.message_id,
            contact_id: emails.contact_id,
            deal_id: emails.deal_id,
            proposal_id: emails.proposal_id,
          })
          .from(emails)
          .where(
            and(
              eq(emails.direction, "out"),
              inArray(emails.message_id, replyIds),
            ),
          )
      : [];
    const sentById = new Map(answered.map((row) => [row.message_id, row]));
    let stored = 0;
    for (const message of messages) {
      const sent = message.inReplyTo
        ? sentById.get(message.inReplyTo)
        : undefined;
      const contactId = byAddress.get(message.from) ?? sent?.contact_id;
      if (!contactId) continue;
      const inserted = await database
        .insert(emails)
        .values({
          direction: "in",
          status: "received",
          from_address: message.fromName
            ? `${message.fromName} <${message.from}>`
            : message.from,
          to_address: message.to || mailbox.from_address,
          subject: message.subject,
          body: message.text,
          contact_id: contactId,
          deal_id: sent?.deal_id ?? null,
          proposal_id: sent?.proposal_id ?? null,
          message_id: message.messageId,
          in_reply_to: message.inReplyTo ?? null,
          sent_at: message.date,
          sales_id: mailbox.sales_id,
        })
        .onConflictDoNothing()
        .returning({ id: emails.id });
      stored += inserted.length;
    }
    return stored;
  }

  return {
    store,

    /** Reads every mailbox with IMAP set up. One that fails says why and doesn't stop the others. */
    async readAll() {
      const withImap = await database
        .select()
        .from(mailboxes)
        .where(
          and(
            isNotNull(mailboxes.imap_host),
            isNotNull(mailboxes.imap_password),
          ),
        );
      let stored = 0;
      for (const mailbox of withImap) {
        try {
          const batch = await readInbox(
            {
              ...mailbox,
              imapPassword: await decryptSecret(
                deps.encryptionKey,
                mailbox.imap_password ?? "",
              ),
            },
            {
              uidValidity: mailbox.imap_uid_validity,
              lastUid: mailbox.imap_last_uid,
            },
          );
          stored += await store(mailbox, batch.messages);
          await database
            .update(mailboxes)
            .set({
              imap_uid_validity: batch.uidValidity,
              imap_last_uid: batch.lastUid,
              imap_checked_at: new Date().toISOString(),
              imap_error: null,
            })
            .where(eq(mailboxes.id, mailbox.id));
        } catch (error) {
          await database
            .update(mailboxes)
            .set({
              imap_checked_at: new Date().toISOString(),
              imap_error: (error instanceof Error
                ? error.message
                : String(error)
              ).slice(0, 500),
            })
            .where(eq(mailboxes.id, mailbox.id));
        }
      }
      return stored;
    },
  };
}
