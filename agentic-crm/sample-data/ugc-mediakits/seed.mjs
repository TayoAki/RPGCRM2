#!/usr/bin/env node
// Fills a Magpie CRM workspace with the UGC agency sample data in data.mjs, through the public API.
//
//   node seed.mjs https://your-workspace.up.railway.app mgp_your_api_key
//
// Needs Node 18 or newer and nothing else. Create the key in the CRM: Settings, API keys.
// Writes CSV copies of the companies, contacts and deals next to this file with --csv instead.

import { writeFileSync } from "node:fs";
import {
  COMPANIES,
  CONTACT_NOTES,
  CONTACTS,
  DEAL_NOTES,
  DEALS,
  FOLLOW_UPS,
  MEETINGS,
  TAGS,
} from "./data.mjs";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const at = (offsetMs) => new Date(now + offsetMs).toISOString();
const dateOnly = (offsetDays) => at(offsetDays * DAY).slice(0, 10);

const companyOf = (key) => COMPANIES.find((company) => company.key === key);
const domainOf = (company) => new URL(company.website).host;
const emailOf = (contact) =>
  `${contact.first_name.toLowerCase()}@${domainOf(companyOf(contact.company))}`;
const phoneOf = (index) => `+1 555 01${String(index).padStart(2, "0")}`;

const STAGE_LABELS = {
  opportunity: "Opportunity",
  "proposal-sent": "Proposal Sent",
  "in-negociation": "In Negotiation",
  won: "Won",
  lost: "Lost",
  delayed: "Delayed",
};

function csv(rows) {
  const cell = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const header = Object.keys(rows[0]);
  return [header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((row) => row.map(cell).join(","))
    .join("\n")
    .concat("\n");
}

function writeCsv() {
  const here = new URL(".", import.meta.url);
  writeFileSync(
    new URL("companies.csv", here),
    csv(
      COMPANIES.map((company) => ({
        name: company.name,
        sector: company.sector,
        size: company.size,
        linkedin_url: "",
        website: company.website,
        phone_number: "",
        address: "",
        zipcode: "",
        city: company.city,
        state_abbr: company.state_abbr,
        country: company.country,
        description: company.description,
        revenue: company.revenue,
        tax_identifier: "",
      })),
    ),
  );
  writeFileSync(
    new URL("contacts.csv", here),
    csv(
      CONTACTS.map((contact, index) => ({
        first_name: contact.first_name,
        last_name: contact.last_name,
        gender: "",
        title: contact.title,
        background: contact.background ?? "",
        first_seen: "",
        last_seen: "",
        has_newsletter: "false",
        status: contact.status,
        tags: contact.tags
          .map((key) => TAGS.find((tag) => tag.key === key).name)
          .join(", "),
        linkedin_url: "",
        company: companyOf(contact.company).name,
        email_work: emailOf(contact),
        email_home: "",
        email_other: "",
        phone_work: phoneOf(index + 1),
        phone_home: "",
        phone_other: "",
      })),
    ),
  );
  writeFileSync(
    new URL("deals.csv", here),
    csv(
      DEALS.map((deal) => ({
        name: deal.name,
        company: companyOf(deal.company).name,
        categories: "",
        stage: STAGE_LABELS[deal.stage],
        amount: deal.amount,
        expected_closing_date: dateOnly(deal.closesInDays),
        description: deal.description ?? "",
      })),
    ),
  );
  console.log("Wrote companies.csv, contacts.csv and deals.csv.");
}

async function seed(base, key) {
  const api = `${base.replace(/\/+$/, "")}/api/v1`;
  const call = async (method, path, body) => {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const answer = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `${method} ${path} failed (${response.status}): ${answer.error ?? response.statusText}`,
      );
    }
    return answer.data;
  };
  const create = (object, body) => call("POST", `/${object}`, body);

  const me = await call("GET", "/me");
  console.log(`Signed in as ${me.first_name} ${me.last_name}.`);
  const existing = await call(
    "GET",
    `/companies?filter=${encodeURIComponent(JSON.stringify({ name: COMPANIES[0].name }))}`,
  );
  if (existing.length) {
    throw new Error(
      `${COMPANIES[0].name} is already in this workspace, so the sample data looks seeded. Nothing was added.`,
    );
  }

  const tagIds = {};
  for (const tag of TAGS) {
    tagIds[tag.key] = (await create("tags", { name: tag.name, color: tag.color })).id;
  }

  const companyIds = {};
  for (const { key, ...company } of COMPANIES) {
    companyIds[key] = (await create("companies", company)).id;
  }
  console.log(`Added ${COMPANIES.length} companies.`);

  const contactIds = {};
  for (const [index, contact] of CONTACTS.entries()) {
    const { key, company, tags, ...fields } = contact;
    contactIds[key] = (
      await create("contacts", {
        ...fields,
        company_id: companyIds[company],
        tags: tags.map((tag) => tagIds[tag]),
        email_jsonb: [{ email: emailOf(contact), type: "Work" }],
        phone_jsonb: [{ number: phoneOf(index + 1), type: "Work" }],
        lead_source: companyOf(company).lead_source,
      })
    ).id;
  }
  console.log(`Added ${CONTACTS.length} contacts.`);

  const dealIds = {};
  const positions = {};
  for (const deal of DEALS) {
    positions[deal.stage] = (positions[deal.stage] ?? 0) + 1;
    const created = at(-deal.createdDaysAgo * DAY);
    dealIds[deal.key] = (
      await create("deals", {
        name: deal.name,
        company_id: companyIds[deal.company],
        contact_ids: deal.contacts.map((contact) => contactIds[contact]),
        stage: deal.stage,
        amount: deal.amount,
        description: deal.description ?? null,
        expected_closing_date: dateOnly(deal.closesInDays),
        lead_source: companyOf(deal.company).lead_source,
        index: positions[deal.stage] - 1,
        created_at: created,
        updated_at: created,
      })
    ).id;
  }
  console.log(`Added ${DEALS.length} deals.`);

  for (const followUp of FOLLOW_UPS) {
    await create("tasks", {
      contact_id: contactIds[followUp.contact],
      type: followUp.type,
      text: followUp.text,
      // Midday, so a follow-up due today stays today in any time zone close to the seeder's.
      due_date: new Date(`${dateOnly(followUp.dueInDays)}T17:00:00Z`).toISOString(),
    });
  }
  console.log(`Added ${FOLLOW_UPS.length} follow-ups.`);

  for (const meeting of MEETINGS) {
    const contact = CONTACTS.find((each) => each.key === meeting.contact);
    await create("meetings", {
      title: meeting.title,
      contact_id: contactIds[meeting.contact],
      deal_id: dealIds[meeting.deal],
      company_id: companyIds[contact.company],
      start_at: at(meeting.startsInHours * HOUR),
      end_at: at(meeting.startsInHours * HOUR + meeting.minutes * 60_000),
      location: meeting.location,
      attendees: [
        {
          name: `${contact.first_name} ${contact.last_name}`,
          email: emailOf(contact),
        },
      ],
    });
  }
  console.log(`Added ${MEETINGS.length} meetings.`);

  for (const note of CONTACT_NOTES) {
    await create("contact_notes", {
      contact_id: contactIds[note.contact],
      text: note.text,
      status: note.status,
      date: at(-note.daysAgo * DAY),
    });
  }
  for (const note of DEAL_NOTES) {
    await create("deal_notes", {
      deal_id: dealIds[note.deal],
      text: note.text,
      date: at(-note.daysAgo * DAY),
    });
  }
  console.log(`Added ${CONTACT_NOTES.length + DEAL_NOTES.length} notes.`);
  console.log("Done. Open Today to see it.");
}

const [first, second] = process.argv.slice(2);
if (first === "--csv") {
  writeCsv();
} else if (first && second) {
  seed(first, second).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
} else {
  console.error(
    "Usage: node seed.mjs <workspace address> <API key>\n       node seed.mjs --csv",
  );
  process.exit(1);
}
