import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import {
  createCrmMail,
  type OutgoingMessage,
  textToHtml,
} from "../src/crm/mail";
import { createCrmInbox, type InboxMessage } from "../src/crm/mail-inbox";
import { mailboxes } from "../src/crm/schema";
import { createDatabase } from "../src/db/client";
import { crmTestClient, type Json } from "./support/crm";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const encryptionKey = Buffer.from(
  crypto.getRandomValues(new Uint8Array(32)),
).toString("base64");

let sent: OutgoingMessage[] = [];
let refuse: string | null = null;
let passwordUsed = "";
const mail = createCrmMail({
  database,
  encryptionKey,
  createTransport: (mailbox) => ({
    async send(message) {
      passwordUsed = mailbox.smtpPassword;
      if (refuse) throw new Error(refuse);
      sent.push(message);
      return { messageId: `<${crypto.randomUUID()}@test>` };
    },
    async verify() {
      if (refuse) throw new Error(refuse);
    },
  }),
});
const crm = crmTestClient(database, { mail });
const { run, call, create } = crm;

const mailbox = {
  from_name: "Ada at Acme",
  from_address: `ada-${run}@acme.test`,
  smtp_host: "smtp.acme.test",
  smtp_port: 587,
  smtp_user: `ada-${run}@acme.test`,
  smtp_password: "app password",
};

beforeAll(async () => {
  await crm.setUp();
  // Other test files' mailboxes would answer for the shared one.
  await database.delete(mailboxes).where(sql`${mailboxes.sales_id} is null`);
});
beforeEach(() => {
  sent = [];
  refuse = null;
});
afterAll(async () => {
  await crm.tearDown();
  await database.$client.end({ timeout: 5 });
});

test("a person's mailbox is saved with its password encrypted and never shown again", async () => {
  const saved = await call("PUT", "/mail/mailboxes/mine", mailbox, "member");
  const [row] = await database
    .select()
    .from(mailboxes)
    .where(eq(mailboxes.from_address, mailbox.from_address));
  const listed = (await call("GET", "/mail/mailboxes", undefined, "member"))
    .json.data as { mine: Json };

  expect(saved.status).toBe(200);
  expect(row?.smtp_password).not.toContain("app password");
  expect(listed.mine).toMatchObject({
    from_address: mailbox.from_address,
    has_smtp_password: true,
  });
  expect(Object.keys(listed.mine)).not.toContain("smtp_password");
  expect(JSON.stringify(listed)).not.toContain("app password");
});

test("saving a mailbox without a password keeps the one already saved", async () => {
  await call("PUT", "/mail/mailboxes/mine", mailbox, "member");
  const { smtp_password: _, ...withoutPassword } = mailbox;
  await call(
    "PUT",
    "/mail/mailboxes/mine",
    { ...withoutPassword, smtp_host: "smtp2.acme.test" },
    "member",
  );

  await call(
    "POST",
    "/mail/emails",
    { to_address: "client@example.com", subject: "Hi", body: "Hello" },
    "member",
  );

  expect(passwordUsed).toBe("app password");
});

test("only an admin sets the shared mailbox", async () => {
  const asMember = await call(
    "PUT",
    "/mail/mailboxes/shared",
    mailbox,
    "member",
  );
  const asAdmin = await call("PUT", "/mail/mailboxes/shared", {
    ...mailbox,
    from_address: `team-${run}@acme.test`,
  });

  expect(asMember.status).toBe(403);
  expect(asAdmin.status).toBe(200);
});

test("an email goes out from the sender's own mailbox and is kept as sent", async () => {
  await call("PUT", "/mail/mailboxes/mine", mailbox, "member");
  const contact = await create("contacts", {
    first_name: "Cleo",
    last_name: `Mail${run}`,
  });

  const { status, json } = await call(
    "POST",
    "/mail/emails",
    {
      to_address: "cleo@example.com",
      subject: "Your proposal\r\nBcc: x@evil.test",
      body: "Hi Cleo,\n\nIt's at https://acme.test/p/1.",
      contact_id: contact.id,
    },
    "member",
  );

  expect(status).toBe(201);
  expect(json.data).toMatchObject({
    status: "sent",
    from_address: mailbox.from_address,
    contact_id: contact.id,
  });
  expect(sent[0]).toMatchObject({
    from: { name: "Ada at Acme", address: mailbox.from_address },
    to: "cleo@example.com",
    subject: "Your proposal Bcc: x@evil.test",
  });
  expect(sent[0]?.html).toContain(
    '<a href="https://acme.test/p/1">https://acme.test/p/1</a>.',
  );
});

test("someone without their own mailbox sends from the shared one", async () => {
  await call("PUT", "/mail/mailboxes/shared", {
    ...mailbox,
    from_address: `team-${run}@acme.test`,
  });

  await call("POST", "/mail/emails", {
    to_address: "someone@example.com",
    subject: "From the team",
    body: "Hello",
  });

  expect(sent[0]?.from.address).toBe(`team-${run}@acme.test`);
});

test("a refused send is kept as failed with the reason, and can be sent again", async () => {
  await call("PUT", "/mail/mailboxes/mine", mailbox, "member");
  refuse = "535 Authentication failed";

  const failed = (
    await call(
      "POST",
      "/mail/emails",
      { to_address: "x@example.com", subject: "S", body: "B" },
      "member",
    )
  ).json.data as Json;
  refuse = null;
  const retried = (
    await call("POST", `/mail/emails/${failed.id}/send`, undefined, "member")
  ).json.data as Json;

  expect(failed).toMatchObject({
    status: "failed",
    error: "535 Authentication failed",
  });
  expect(retried.status).toBe("sent");
});

test("an email for later waits until it is due", async () => {
  await call("PUT", "/mail/mailboxes/mine", mailbox, "member");
  const scheduled = (
    await call(
      "POST",
      "/mail/emails",
      {
        to_address: "later@example.com",
        subject: "Later",
        body: "B",
        send_at: new Date(Date.now() + 3600_000).toISOString(),
      },
      "member",
    )
  ).json.data as Json;
  await mail.sendDue();
  const sentBefore = sent.length;
  await database.execute(
    sql`update crm.emails set send_at = now() - interval '1 minute' where id = ${scheduled.id}`,
  );
  await mail.sendDue();

  expect(scheduled.status).toBe("scheduled");
  expect(sentBefore).toBe(0);
  expect(sent.map((message) => message.to)).toEqual(["later@example.com"]);
});

test("a draft stays a draft, and only its writer or an admin sends or removes it", async () => {
  await call("PUT", "/mail/mailboxes/mine", mailbox, "member");
  const draft = (
    await call(
      "POST",
      "/mail/emails",
      { to_address: "d@example.com", subject: "Draft", body: "B", draft: true },
      "member",
    )
  ).json.data as Json;
  const adminDraft = (
    await call("POST", "/mail/emails", {
      to_address: "e@example.com",
      subject: "Admin's",
      body: "B",
      draft: true,
    })
  ).json.data as Json;

  const othersSend = await call(
    "POST",
    `/mail/emails/${adminDraft.id}/send`,
    undefined,
    "member",
  );
  const removed = await call(
    "DELETE",
    `/mail/emails/${draft.id}`,
    undefined,
    "member",
  );

  expect(draft.status).toBe("draft");
  expect(sent).toHaveLength(0);
  expect(othersSend.status).toBe(403);
  expect(removed.status).toBe(200);
});

test("a recipient that isn't an address is refused before anything is saved", async () => {
  const { status, json } = await call("POST", "/mail/emails", {
    to_address: "not an address",
    subject: "S",
    body: "B",
  });

  expect(status).toBe(400);
  expect(String(json.error)).toContain("isn't an email address");
});

test("mail from a contact, or a reply to mail the CRM sent, lands on the contact's timeline", async () => {
  const contact = await create("contacts", {
    first_name: "Rae",
    last_name: `Reply${run}`,
    email_jsonb: [{ email: `Rae-${run}@Client.test`, type: "Work" }],
  });
  await call("PUT", "/mail/mailboxes/mine", mailbox, "member");
  const deal = await create("deals", {
    name: `Inbox ${run}`,
    stage: "opportunity",
  });
  const out = (
    await call(
      "POST",
      "/mail/emails",
      {
        to_address: "assistant@other.test",
        subject: "Proposal",
        body: "B",
        contact_id: contact.id,
        deal_id: deal.id,
      },
      "member",
    )
  ).json.data as Json;
  const [box] = await database
    .select()
    .from(mailboxes)
    .where(eq(mailboxes.from_address, mailbox.from_address));
  const message = (over: Partial<InboxMessage>): InboxMessage => ({
    messageId: `<${crypto.randomUUID()}@client.test>`,
    from: "nobody@else.test",
    to: mailbox.from_address,
    subject: "Re: Proposal",
    text: "Sounds good",
    date: new Date().toISOString(),
    ...over,
  });
  const inbox = createCrmInbox({ database, encryptionKey });
  const fromContact = message({ from: `rae-${run}@client.test` });

  const stored = await inbox.store(box!, [
    fromContact,
    fromContact,
    message({
      from: "assistant@other.test",
      inReplyTo: String(out.message_id),
    }),
    message({ from: "stranger@else.test" }),
  ]);
  const { json } = await call(
    "GET",
    `/emails?filter=${encodeURIComponent(JSON.stringify({ contact_id: contact.id, direction: "in" }))}`,
  );

  expect(stored).toBe(2);
  expect(json.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ status: "received", deal_id: null }),
      expect.objectContaining({ status: "received", deal_id: deal.id }),
    ]),
  );
});

test("plain text becomes safe HTML", () => {
  expect(textToHtml("<b>Hi</b>\n\nhttps://a.test/x?y=1&z=2")).toBe(
    '<div style="font-family:sans-serif;font-size:14px;line-height:1.5"><p>&lt;b&gt;Hi&lt;/b&gt;</p><p><a href="https://a.test/x?y=1&amp;z=2">https://a.test/x?y=1&amp;z=2</a></p></div>',
  );
});
