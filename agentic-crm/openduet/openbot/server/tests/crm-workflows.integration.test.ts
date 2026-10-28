import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { bookingToken } from "../src/crm/bookings";
import type { OutgoingMessage } from "../src/crm/mail";
import {
  emails,
  mailboxes,
  recordEvents,
  workflowRuns,
  workflows,
} from "../src/crm/schema";
import { createCrmServices } from "../src/crm/services";
import { MAX_DEPTH } from "../src/crm/workflows/engine";
import { RECIPES } from "../src/crm/workflows/recipes";
import { createCrmPublicRoutes } from "../src/crm/workflows/routes";
import { createDatabase } from "../src/db/client";
import { crmTestClient, type Json } from "./support/crm";
import { TEST_POOL, testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), TEST_POOL);
const encryptionKey = Buffer.from(
  crypto.getRandomValues(new Uint8Array(32)),
).toString("base64");

let sent: OutgoingMessage[] = [];
let refuse: string | null = null;
let written: { system: string; prompt: string }[] = [];
let agentTasks: { ownerUserId: string; title: string; instruction: string }[] =
  [];

const services = createCrmServices({
  database,
  encryptionKey,
  appUrl: "https://crm.test",
  apiUrl: "https://api.test",
  writeText: async (input) => {
    written.push(input);
    return "Written by the model.";
  },
  hasModel: async () => true,
  startAgentTask: async (ownerUserId, task) => {
    agentTasks.push({ ownerUserId, ...task });
    return { id: `task-${agentTasks.length}` };
  },
  createTransport: () => ({
    async send(message) {
      if (refuse) throw new Error(refuse);
      sent.push(message);
      return { messageId: `<${crypto.randomUUID()}@test>` };
    },
    async verify() {},
  }),
});
const crm = crmTestClient(database, {
  mail: services.mail,
  automation: services.automation,
});
const publicRoutes = createCrmPublicRoutes(services.automation);
const { run, create, update, call } = crm;
const mine: number[] = [];

async function settle() {
  for (let pass = 0; pass < 50; pass++) {
    const events = await services.engine.dispatchEvents();
    const runs = await services.engine.runDue();
    if (events === 0 && runs === 0) return;
  }
  throw new Error("Automations didn't settle.");
}

// As if every delay of this file's runs had passed.
async function wakeAll() {
  await database
    .update(workflowRuns)
    .set({ wake_at: sql`now()` })
    .where(
      and(
        eq(workflowRuns.status, "waiting"),
        inArray(workflowRuns.workflow_id, mine),
      ),
    );
  await settle();
}

async function automation(key: string, changes: Json = {}) {
  const recipe = RECIPES.find((each) => each.key === key);
  if (!recipe) throw new Error(`No recipe ${key}`);
  const { key: _, needs: __, ...input } = recipe;
  const { status, json } = await call("POST", "/automation/workflows", {
    ...input,
    ...changes,
    enabled: true,
  });
  if (status !== 201) throw new Error(JSON.stringify(json));
  const made = json.data as Json;
  mine.push(Number(made.id));
  return made;
}

async function runsOf(workflow: Json) {
  return database
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.workflow_id, Number(workflow.id)))
    .orderBy(workflowRuns.id);
}

const contactWith = (first: string, extra: Json = {}) =>
  create("contacts", {
    first_name: first,
    last_name: `Flow${run}`,
    email_jsonb: [
      { email: `${first.toLowerCase()}-${run}@client.test`, type: "Work" },
    ],
    ...extra,
  });

beforeAll(async () => {
  await crm.setUp();
  // Other files' automations and events stay out of this file's runs.
  await database.update(workflows).set({ enabled: false });
  await database
    .update(recordEvents)
    .set({ processed_at: sql`now()` })
    .where(isNull(recordEvents.processed_at));
  await database.delete(mailboxes).where(isNull(mailboxes.sales_id));
  await call("PUT", "/mail/mailboxes/shared", {
    from_address: `team-${run}@acme.test`,
    smtp_host: "smtp.acme.test",
    smtp_user: "team",
    smtp_password: "secret",
  });
});

beforeEach(async () => {
  // One automation at a time: each test switches on what it needs.
  if (mine.length) {
    await database
      .update(workflows)
      .set({ enabled: false })
      .where(inArray(workflows.id, mine));
    await database
      .update(workflowRuns)
      .set({ status: "canceled" })
      .where(
        and(
          inArray(workflowRuns.workflow_id, mine),
          inArray(workflowRuns.status, ["queued", "waiting"]),
        ),
      );
  }
  await settle();
  sent = [];
  refuse = null;
  written = [];
  agentTasks = [];
});

afterAll(async () => {
  if (mine.length)
    await database.delete(workflows).where(inArray(workflows.id, mine));
  await crm.tearDown();
  await database.$client.end({ timeout: 5 });
});

test("a won deal makes its company and its contacts clients", async () => {
  const workflow = await automation("won-deal-to-clients");
  const company = await create("companies", { name: `Winner ${run}` });
  const contact = await contactWith("Wendy", { company_id: company.id });
  const deal = await create("deals", {
    name: `Win ${run}`,
    stage: "opportunity",
    company_id: company.id,
    contact_ids: [contact.id],
  });
  await settle();

  await update("deals", deal.id, { stage: "won" });
  await settle();

  expect(
    (await crm.call("GET", `/companies/${company.id}`)).json.data,
  ).toMatchObject({
    lifecycle_stage: "client",
  });
  expect(
    (await crm.call("GET", `/contacts/${contact.id}`)).json.data,
  ).toMatchObject({
    lifecycle_stage: "client",
    status: "in-contract",
  });
  const [only] = await runsOf(workflow);
  expect(only?.status).toBe("completed");
  expect(
    (only?.log as Json[] | undefined)?.map((entry) => entry.status),
  ).toEqual(["done", "done"]);
});

test("an automation's own changes don't start it again", async () => {
  const workflow = await automation("won-deal-to-clients", {
    trigger: { type: "record", object: "contacts", on: ["updated"] },
    steps: [
      {
        id: "shout",
        type: "update_record",
        target: "record",
        values: { title: "{{record.title}}!" },
      },
    ],
  });
  const contact = await contactWith("Echo", { title: "CEO" });

  await update("contacts", contact.id, { title: "CTO" });
  await settle();

  expect((await runsOf(workflow)).length).toBe(1);
  expect(
    (await crm.call("GET", `/contacts/${contact.id}`)).json.data,
  ).toMatchObject({
    title: "CTO!",
  });
});

test("automations that set each other off stop after a few rounds", async () => {
  const contact = await contactWith("Ping", { background: "" });
  const bounce = (letter: string) => ({
    trigger: {
      type: "record",
      object: "contacts",
      on: ["updated"],
      when: {
        match: "all",
        conditions: [
          { field: "record.last_name", op: "is", value: `Flow${run}` },
        ],
      },
    },
    steps: [
      {
        id: "append",
        type: "update_record",
        target: "record",
        values: { background: `{{record.background}}${letter}` },
      },
    ],
  });
  const ping = await automation("won-deal-to-clients", bounce("a"));
  const pong = await automation("won-deal-to-clients", bounce("b"));

  await update("contacts", contact.id, { title: "Start" });
  await settle();

  const runs = (await runsOf(ping)).length + (await runsOf(pong)).length;
  expect(runs).toBe(2 * (MAX_DEPTH + 1));
});

test("proposal follow-ups go out until the client replies, then stop", async () => {
  const workflow = await automation("proposal-follow-ups");
  const contact = await contactWith("Paula");
  const deal = await create("deals", {
    name: `Follow ${run}`,
    stage: "in-negociation",
    contact_ids: [contact.id],
  });
  const proposal = await create("proposals", {
    deal_id: deal.id,
    contact_id: contact.id,
    title: "Website",
  });
  await settle();

  await update("proposals", proposal.id, {
    status: "sent",
    sent_at: new Date(Date.now() - 60_000).toISOString(),
  });
  await settle();
  const movedStage = (await crm.call("GET", `/deals/${deal.id}`)).json
    .data as Json;
  await wakeAll();
  const firstFollowUp = sent.map((message) => message.to);
  await database.insert(emails).values({
    direction: "in",
    status: "received",
    to_address: "team@acme.test",
    from_address: `paula-${run}@client.test`,
    subject: "Re: Website",
    body: "Let's talk",
    contact_id: Number(contact.id),
    message_id: `<${crypto.randomUUID()}@client.test>`,
    sent_at: new Date().toISOString(),
  });
  await wakeAll();

  expect(movedStage.stage).toBe("proposal-sent");
  expect(firstFollowUp).toEqual([`paula-${run}@client.test`]);
  expect(sent).toHaveLength(1);
  expect(sent[0]?.text).toBe("Written by the model.");
  expect(written[0]?.prompt).toContain("https://crm.test/proposal/");
  const [only] = await runsOf(workflow);
  expect(only?.status).toBe("completed");
  expect((only?.log as Json[] | undefined)?.at(-1)).toMatchObject({
    step: "done_2",
    status: "stop",
  });
});

test("a send that fails is tried again with the same email, then the run fails with the reason", async () => {
  const workflow = await automation("welcome-new-customer", {
    steps: [
      {
        id: "hello",
        type: "send_email",
        subject: "Hi",
        body: "Hello {{contact.first_name}}",
      },
    ],
  });
  const contact = await contactWith("Fay");
  const deal = await create("deals", {
    name: `Fail ${run}`,
    stage: "opportunity",
    contact_ids: [contact.id],
  });
  await settle();
  refuse = "421 Try again later";

  await update("deals", deal.id, { stage: "won" });
  await settle();
  await wakeAll();
  await wakeAll();

  const [only] = await runsOf(workflow);
  expect(only).toMatchObject({
    status: "failed",
    error: "421 Try again later",
  });
  const attempts = await database
    .select()
    .from(emails)
    .where(eq(emails.workflow_run_id, Number(only?.id)));
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({ status: "failed", body: "Hello Fay" });
});

test("an email to review first waits as a draft, with a task for its owner", async () => {
  await automation("welcome-new-customer", {
    steps: [
      {
        id: "draft",
        type: "send_email",
        subject: "Welcome",
        body: "Hi",
        review_first: true,
      },
    ],
  });
  const contact = await contactWith("Rita");
  const deal = await create("deals", {
    name: `Review ${run}`,
    stage: "opportunity",
    contact_ids: [contact.id],
  });
  await settle();

  await update("deals", deal.id, { stage: "won" });
  await settle();

  expect(sent).toHaveLength(0);
  const drafts = await database
    .select()
    .from(emails)
    .where(eq(emails.contact_id, Number(contact.id)));
  expect(drafts.map((row) => row.status)).toEqual(["draft"]);
  const { json } = await call(
    "GET",
    `/tasks?filter=${encodeURIComponent(JSON.stringify({ contact_id: contact.id }))}`,
  );
  expect((json.data as Json[])[0]?.text).toContain(
    'Read and send the email "Welcome"',
  );
});

test("a reminder goes out once, a day before the meeting, and not for meetings booked too late", async () => {
  const recipe = RECIPES.find((each) => each.key === "pre-call-reminder");
  const workflow = await automation("pre-call-reminder", {
    trigger: {
      ...recipe?.trigger,
      when: {
        match: "all",
        conditions: [
          { field: "record.status", op: "is", value: "scheduled" },
          { field: "contact.last_name", op: "is", value: `Flow${run}` },
        ],
      },
    },
  });
  await database
    .update(workflows)
    .set({ enabled_at: new Date(Date.now() - 2 * 86_400_000).toISOString() })
    .where(eq(workflows.id, Number(workflow.id)));
  const contact = await contactWith("Remy");
  const created = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const meeting = await create("meetings", {
    title: "Kickoff",
    contact_id: contact.id,
    start_at: new Date(Date.now() + 86_400_000 - 5 * 60_000).toISOString(),
    location: "https://meet.test/abc",
    created_at: created,
  });
  await create("meetings", {
    title: "Last minute",
    contact_id: contact.id,
    start_at: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  });

  const first = await services.engine.sweepDates();
  const again = await services.engine.sweepDates();
  await settle();

  expect(first).toBe(1);
  expect(again).toBe(0);
  expect(sent.map((message) => message.subject)).toEqual(["Tomorrow: Kickoff"]);
  expect(sent[0]?.text).toContain("https://meet.test/abc");
  const [reminder] = await runsOf(workflow);
  expect(reminder?.status).toBe("waiting");
  expect(Date.parse(String(reminder?.wake_at))).toBe(
    Date.parse(String(meeting.start_at)) - 3_600_000,
  );
});

test("a schedule runs once per occurrence for each record that matches", async () => {
  const workflow = await automation("won-deal-to-clients", {
    trigger: {
      type: "schedule",
      cron: "* * * * *",
      object: "deals",
      when: {
        match: "all",
        conditions: [
          { field: "record.name", op: "contains", value: `Sched ${run}` },
        ],
      },
    },
    steps: [{ id: "note", type: "add_note", target: "deal", text: "Checked." }],
  });
  await database
    .update(workflows)
    .set({ enabled_at: new Date(Date.now() - 3_600_000).toISOString() })
    .where(eq(workflows.id, Number(workflow.id)));
  await create("deals", { name: `Sched ${run} A`, stage: "opportunity" });
  await create("deals", { name: `Sched ${run} B`, stage: "opportunity" });
  await create("deals", { name: `Other ${run}`, stage: "opportunity" });

  const now = new Date();
  const started = await services.engine.sweepSchedules(now);
  const again = await services.engine.sweepSchedules(now);
  await settle();

  expect(started).toBe(2);
  expect(again).toBe(0);
  expect((await runsOf(workflow)).map((each) => each.status)).toEqual([
    "completed",
    "completed",
  ]);
});

test("a website form becomes a contact with where they came from", async () => {
  const workflow = await automation("lead-source-from-forms");
  const { json } = await call("GET", `/automation/workflows/${workflow.id}`);
  const address = new URL(String((json.data as Json).webhook_url));

  const wrong = await publicRoutes.request(
    address.pathname.replace("/api/crm-public", "").replace(/[^/]+$/, "nope"),
    {
      method: "POST",
      body: "{}",
    },
  );
  const accepted = await publicRoutes.request(
    address.pathname.replace("/api/crm-public", ""),
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: `Lena-${run}@Lead.test`,
        name: "Lena",
        company: `Leadco ${run}`,
        utm_source: "linkedin",
        utm_campaign: "fall-launch",
        message: "Need a quote",
      }).toString(),
    },
  );
  await settle();

  expect(wrong.status).toBe(404);
  expect(accepted.status).toBe(202);
  const { data } = await crm.list("contacts", {
    "first_name@eq": "Lena",
    "company_name@eq": `Leadco ${run}`,
  });
  expect(data[0]).toMatchObject({
    lead_source: "linkedin",
    lead_source_detail: "fall-launch",
    email_jsonb: [{ email: `lena-${run}@lead.test`, type: "Work" }],
  });
  const notes = await crm.list("contact_notes", { contact_id: data[0]?.id });
  expect(notes.data[0]?.text).toBe("From the website form: Need a quote");
});

test("a Cal.com booking adds the contact and the meeting; moving or canceling it follows", async () => {
  const workflow = await automation("booking-updates-crm");
  const path = `/bookings/${bookingToken(encryptionKey)}`;
  const calcom = (triggerEvent: string, payload: Json) =>
    publicRoutes.request(path, {
      method: "POST",
      body: JSON.stringify({ triggerEvent, payload }),
    });
  const email = `cal-${run}@booker.test`;
  const booked = {
    uid: `cal-${run}`,
    title: "Intro call",
    startTime: "2026-12-01T15:00:00Z",
    endTime: "2026-12-01T15:30:00Z",
    attendees: [{ name: "Carla Booker", email }],
    metadata: { videoCallUrl: "https://cal.video/x" },
    responses: {
      company: { value: `Bookco ${run}` },
      notes: { value: "Wants pricing" },
    },
  };

  await calcom("BOOKING_CREATED", booked);
  await settle();
  const {
    data: [contact],
  } = await crm.list("contacts", {
    "last_name@eq": "Booker",
    "company_name@eq": `Bookco ${run}`,
  });
  const {
    data: [meeting],
  } = await crm.list("meetings", { contact_id: contact?.id });
  await calcom("BOOKING_RESCHEDULED", {
    ...booked,
    uid: `cal-${run}-2`,
    rescheduleUid: `cal-${run}`,
    startTime: "2026-12-02T16:00:00Z",
  });
  const moved = (await crm.list("meetings", { contact_id: contact?.id })).data;
  await calcom("BOOKING_CANCELLED", { ...booked, uid: `cal-${run}-2` });
  const canceled = (await crm.list("meetings", { contact_id: contact?.id }))
    .data;

  expect(contact).toMatchObject({
    first_name: "Carla",
    lead_source: "Cal.com",
    lifecycle_stage: "prospect",
  });
  expect(meeting).toMatchObject({
    source: "calcom",
    location: "https://cal.video/x",
    status: "scheduled",
  });
  expect(meeting?.deal_id).toBeNumber();
  const deal = (await crm.call("GET", `/deals/${meeting?.deal_id}`)).json
    .data as Json;
  expect(deal).toMatchObject({
    stage: "opportunity",
    contact_ids: [contact?.id],
    lead_source: "Cal.com",
  });
  expect(agentTasks[0]?.instruction).toContain(email);
  expect(moved).toHaveLength(1);
  expect(moved[0]).toMatchObject({
    start_at: "2026-12-02T16:00:00.000Z",
    external_id: `cal-${run}-2`,
  });
  expect(canceled[0]?.status).toBe("canceled");
  expect((await runsOf(workflow)).map((each) => each.status)).toEqual([
    "completed",
  ]);
});

test("a Calendly booking keeps its campaign, and a booking address with the wrong secret is refused", async () => {
  const wrong = await publicRoutes.request("/bookings/not-the-token", {
    method: "POST",
    body: "{}",
  });
  await publicRoutes.request(`/bookings/${bookingToken(encryptionKey)}`, {
    method: "POST",
    body: JSON.stringify({
      event: "invitee.created",
      payload: {
        email: `cly-${run}@booker.test`,
        name: "Cody Lee",
        uri: `https://api.calendly.com/invitees/${run}`,
        scheduled_event: {
          name: "Demo",
          start_time: "2026-12-03T10:00:00Z",
          end_time: "2026-12-03T10:30:00Z",
          location: { join_url: "https://zoom.test/1" },
        },
        tracking: { utm_source: "google", utm_campaign: "brand" },
        questions_and_answers: [{ question: "Team size", answer: "12" }],
      },
    }),
  });

  expect(wrong.status).toBe(404);
  const { data } = await crm.list("contacts", {
    "last_name@eq": "Lee",
    "first_name@eq": "Cody",
  });
  expect(data.at(-1)).toMatchObject({
    lead_source: "google",
    lead_source_detail: "utm_source=google, utm_campaign=brand",
  });
});

test("a proposal is drafted by the model, sent as a link, read and accepted, and the deal is won", async () => {
  await automation("proposal-accepted");
  const won = await automation("won-deal-to-clients");
  const company = await create("companies", { name: `Propco ${run}` });
  const contact = await contactWith("Pia", { company_id: company.id });
  const deal = await create("deals", {
    name: `Prop ${run}`,
    stage: "in-negociation",
    amount: 9000,
    company_id: company.id,
    contact_ids: [contact.id],
  });
  await create("deal_notes", {
    deal_id: deal.id,
    text: "Needs a new booking flow",
  });

  const drafted = await call("POST", `/actions/deals/${deal.id}/proposal`, {
    instructions: "Mention the 2 week timeline",
  });
  const proposal = drafted.json.data as Json;
  const hiddenWhileDraft = await publicRoutes.request(
    `/proposals/${proposal.token}`,
  );
  const email = (
    await call("POST", `/actions/proposals/${proposal.id}/send`, {})
  ).json.data as Json;
  const viewed = (await (
    await publicRoutes.request(`/proposals/${proposal.token}`)
  ).json()) as Json;
  const accepted = await publicRoutes.request(
    `/proposals/${proposal.token}/accept`,
    {
      method: "POST",
      body: JSON.stringify({ name: "Pia" }),
    },
  );
  const again = await publicRoutes.request(
    `/proposals/${proposal.token}/accept`,
    {
      method: "POST",
      body: "{}",
    },
  );
  await settle();

  expect(drafted.status).toBe(201);
  expect(proposal).toMatchObject({
    status: "draft",
    body: "Written by the model.",
    amount: 9000,
  });
  expect(written[0]?.prompt).toContain("Needs a new booking flow");
  expect(written[0]?.prompt).toContain("Mention the 2 week timeline");
  expect(hiddenWhileDraft.status).toBe(404);
  expect(email.status).toBe("sent");
  expect(sent[0]?.text).toContain(
    `https://crm.test/proposal/${proposal.token}`,
  );
  expect(viewed.data).toMatchObject({
    status: "viewed",
    client: `Propco ${run}`,
    amount: 9000,
  });
  expect(accepted.status).toBe(200);
  expect(again.status).toBe(400);
  const after = (await call("GET", `/proposals/${proposal.id}`)).json
    .data as Json;
  expect(after).toMatchObject({ status: "accepted" });
  expect(after.viewed_at).toBeString();
  expect((await call("GET", `/deals/${deal.id}`)).json.data).toMatchObject({
    stage: "won",
  });
  expect((await runsOf(won)).map((each) => each.status)).toEqual(["completed"]);
});

test("a proposal marked ready goes out after the wait", async () => {
  const workflow = await automation("delayed-proposal-delivery");
  const contact = await contactWith("Dora");
  const deal = await create("deals", {
    name: `Delay ${run}`,
    stage: "in-negociation",
    contact_ids: [contact.id],
  });
  const proposal = await create("proposals", {
    deal_id: deal.id,
    title: "Plan",
    body: "# Plan",
  });

  await update("proposals", proposal.id, { status: "ready" });
  await settle();
  const waiting = (await runsOf(workflow))[0];
  const sentBefore = sent.length;
  await wakeAll();

  expect(waiting?.status).toBe("waiting");
  expect(Date.parse(String(waiting?.wake_at)) - Date.now()).toBeGreaterThan(
    3_500_000,
  );
  expect(sentBefore).toBe(0);
  expect(sent[0]?.subject).toBe("Your proposal: Plan");
  expect(
    (await call("GET", `/proposals/${proposal.id}`)).json.data,
  ).toMatchObject({ status: "sent" });
});

test("a manual automation runs on the record it was started from", async () => {
  const workflow = await automation("won-deal-to-clients", {
    trigger: { type: "manual", object: "contacts" },
    steps: [
      {
        id: "tag",
        type: "update_record",
        target: "record",
        values: { status: "hot" },
      },
    ],
  });
  const contact = await contactWith("Manny");

  const started = await call(
    "POST",
    `/automation/workflows/${workflow.id}/run`,
    {
      record_id: contact.id,
    },
  );
  await settle();

  expect(started.status).toBe(201);
  expect(
    (await call("GET", `/contacts/${contact.id}`)).json.data,
  ).toMatchObject({ status: "hot" });
});

test("only an admin changes automations, and a date trigger needs a date field", async () => {
  const recipe = RECIPES[0];
  const { key: _, needs: __, ...input } = recipe ?? ({} as never);

  const asMember = await call("POST", "/automation/workflows", input, "member");
  const badField = await call("POST", "/automation/workflows", {
    ...input,
    trigger: {
      type: "date",
      object: "meetings",
      field: "title",
      offset_minutes: 0,
    },
  });
  const listed = await call(
    "GET",
    "/automation/workflows",
    undefined,
    "member",
  );

  expect(asMember.status).toBe(403);
  expect(badField.status).toBe(400);
  expect(String(badField.json.error)).toContain(
    "meetings has no date field title",
  );
  expect(listed.status).toBe(200);
});

test("changing an automation's steps makes a new version; a run underway keeps its own", async () => {
  const workflow = await automation("delayed-proposal-delivery");
  const contact = await contactWith("Vera");
  const deal = await create("deals", {
    name: `Version ${run}`,
    stage: "in-negociation",
    contact_ids: [contact.id],
  });
  const proposal = await create("proposals", { deal_id: deal.id, title: "V1" });
  await update("proposals", proposal.id, { status: "ready" });
  await settle();

  const changed = await call("PUT", `/automation/workflows/${workflow.id}`, {
    steps: [{ id: "only_wait", type: "delay", amount: 1, unit: "days" }],
  });
  await wakeAll();

  expect((changed.json.data as Json).version).toBe(2);
  const [first] = await runsOf(workflow);
  expect(first).toMatchObject({ workflow_version: 1, status: "completed" });
  expect(sent.map((message) => message.subject)).toEqual(["Your proposal: V1"]);
});
