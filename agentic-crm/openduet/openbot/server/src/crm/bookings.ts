import { createHmac } from "node:crypto";
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { isEmailAddress } from "./mail";
import type { CrmRecords } from "./records";
import { companies, contacts, deals, meetings, sales } from "./schema";

type Json = Record<string, unknown>;

export type Booking = {
  source: "calcom" | "calendly" | "webhook";
  externalId: string | null;
  // The booking this one replaces, when it was moved.
  replaces: string | null;
  canceled: boolean;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  title: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  notes: string | null;
  organizerEmail: string | null;
  leadSource: string | null;
  leadSourceDetail: string | null;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const object = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};

const DEFAULT_SOURCE = {
  calcom: "Cal.com",
  calendly: "Calendly",
  webhook: "Booking",
};
const CLOSED_STAGES = ["won", "lost"];

function splitName(name: string | null) {
  if (!name) return { firstName: null, lastName: null };
  const [first, ...rest] = name.split(/\s+/);
  return { firstName: first ?? null, lastName: rest.join(" ") || null };
}

function tracking(utm: Json) {
  const tags = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ]
    .map((key) => [key, text(utm[key])] as const)
    .filter(([, value]) => value);
  return {
    source: text(utm.utm_source),
    detail: tags.length
      ? tags.map(([key, value]) => `${key}=${value}`).join(", ")
      : null,
  };
}

function answers(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  const lines = list
    .map((item) => object(item))
    .filter((item) => text(item.answer))
    .map((item) => `${text(item.question) ?? "Answer"}: ${text(item.answer)}`);
  return lines.length ? lines.join("\n") : null;
}

/** A Cal.com, Calendly or plain JSON booking, read into one shape. Null when it isn't a booking. */
export function readBooking(body: unknown): Booking | null {
  const root = object(body);

  if (typeof root.triggerEvent === "string") {
    const payload = object(root.payload);
    const attendee = object(
      Array.isArray(payload.attendees) ? payload.attendees[0] : undefined,
    );
    const responses = object(payload.responses);
    const email = text(attendee.email)?.toLowerCase();
    const start = text(payload.startTime);
    if (!email || !start) return null;
    const utm = tracking(
      object(object(payload.metadata).utm ?? payload.tracking),
    );
    return {
      source: "calcom",
      externalId: text(payload.uid),
      replaces: text(payload.rescheduleUid),
      canceled: root.triggerEvent === "BOOKING_CANCELLED",
      email,
      ...splitName(text(attendee.name)),
      phone: text(object(responses.attendeePhoneNumber).value),
      company: text(object(responses.company).value),
      title: text(payload.title) ?? "Meeting",
      startAt: start,
      endAt: text(payload.endTime),
      location:
        text(object(payload.metadata).videoCallUrl) ?? text(payload.location),
      notes:
        text(payload.additionalNotes) ?? text(object(responses.notes).value),
      organizerEmail:
        text(object(payload.organizer).email)?.toLowerCase() ?? null,
      leadSource: utm.source,
      leadSourceDetail: utm.detail,
    };
  }

  if (typeof root.event === "string" && root.event.startsWith("invitee.")) {
    const payload = object(root.payload);
    const event = object(payload.scheduled_event);
    const email = text(payload.email)?.toLowerCase();
    const start = text(event.start_time);
    if (!email || !start) return null;
    const location = object(event.location);
    const utm = tracking(object(payload.tracking));
    const name = splitName(text(payload.name));
    const host = object(
      Array.isArray(event.event_memberships)
        ? event.event_memberships[0]
        : undefined,
    );
    return {
      source: "calendly",
      externalId: text(payload.uri),
      replaces: text(payload.old_invitee),
      canceled: root.event === "invitee.canceled",
      email,
      firstName: text(payload.first_name) ?? name.firstName,
      lastName: text(payload.last_name) ?? name.lastName,
      phone: text(payload.text_reminder_number),
      company: null,
      title: text(event.name) ?? "Meeting",
      startAt: start,
      endAt: text(event.end_time),
      location: text(location.join_url) ?? text(location.location),
      notes: answers(payload.questions_and_answers),
      organizerEmail: text(host.user_email)?.toLowerCase() ?? null,
      leadSource: utm.source,
      leadSourceDetail: utm.detail,
    };
  }

  const email = text(root.email)?.toLowerCase();
  const start =
    text(root.start_at) ?? text(root.start_time) ?? text(root.startTime);
  if (!email || !start) return null;
  const utm = tracking(root);
  const name = splitName(text(root.name));
  return {
    source: "webhook",
    externalId: text(root.external_id) ?? text(root.id),
    replaces: text(root.replaces),
    canceled: ["canceled", "cancelled"].includes(
      String(root.status ?? "").toLowerCase(),
    ),
    email,
    firstName: text(root.first_name) ?? name.firstName,
    lastName: text(root.last_name) ?? name.lastName,
    phone: text(root.phone),
    company: text(root.company),
    title: text(root.title) ?? "Meeting",
    startAt: start,
    endAt: text(root.end_at) ?? text(root.end_time),
    location: text(root.location),
    notes: text(root.notes),
    organizerEmail: text(root.organizer_email)?.toLowerCase() ?? null,
    leadSource: text(root.lead_source) ?? utm.source,
    leadSourceDetail: text(root.lead_source_detail) ?? utm.detail,
  };
}

/** The secret part of the booking address, from the deployment's key: nothing to store or lose. */
export const bookingToken = (encryptionKey: string) =>
  createHmac("sha256", encryptionKey)
    .update("crm-bookings")
    .digest("hex")
    .slice(0, 40);

/**
 * A booking, into the CRM: the contact found by email or added (with where they came from), and the
 * meeting added, moved or canceled. Automations take it from there.
 */
export async function recordBooking(
  deps: { database: Database; records: CrmRecords },
  booking: Booking,
) {
  const { database, records } = deps;
  if (
    !isEmailAddress(booking.email) ||
    Number.isNaN(Date.parse(booking.startAt))
  ) {
    return null;
  }
  const [host] = booking.organizerEmail
    ? await database
        .select({ id: sales.id })
        .from(sales)
        .where(sql`lower(${sales.email}) = ${booking.organizerEmail}`)
    : [];
  const actor = { service: "booking", salesId: host?.id ?? null };

  const [known] = await database
    .select()
    .from(contacts)
    .where(
      sql`exists (select 1 from jsonb_array_elements(coalesce(${contacts.email_jsonb}, '[]'::jsonb)) entry where lower(entry->>'email') = ${booking.email})`,
    )
    .limit(1);
  let contactId = known?.id;
  if (!known) {
    let companyId: number | null = null;
    if (booking.company) {
      const [company] = await database
        .select({ id: companies.id })
        .from(companies)
        .where(
          sql`lower(${companies.name}) = ${booking.company.toLowerCase()}`,
        );
      companyId =
        company?.id ??
        Number(
          (await records.create(actor, "companies", { name: booking.company }))
            ?.id,
        );
    }
    const created = await records.create(actor, "contacts", {
      first_name: booking.firstName ?? booking.email.split("@")[0],
      last_name: booking.lastName,
      email_jsonb: [{ email: booking.email, type: "Work" }],
      ...(booking.phone
        ? { phone_jsonb: [{ number: booking.phone, type: "Work" }] }
        : {}),
      company_id: companyId,
      lead_source: booking.leadSource ?? DEFAULT_SOURCE[booking.source],
      lead_source_detail: booking.leadSourceDetail,
    });
    contactId = Number(created?.id);
  } else if (
    !known.lead_source &&
    (booking.leadSource || booking.leadSourceDetail)
  ) {
    await records.update(actor, "contacts", known.id, {
      lead_source: booking.leadSource ?? DEFAULT_SOURCE[booking.source],
      lead_source_detail: booking.leadSourceDetail,
    });
  }

  const findMeeting = async (externalId: string | null) =>
    externalId
      ? (
          await database
            .select()
            .from(meetings)
            .where(
              and(
                eq(meetings.source, booking.source),
                eq(meetings.external_id, externalId),
              ),
            )
        )[0]
      : undefined;
  const existing =
    (await findMeeting(booking.externalId)) ??
    (await findMeeting(booking.replaces));

  if (booking.canceled) {
    if (existing) {
      await records.update(actor, "meetings", existing.id, {
        status: "canceled",
      });
    }
    return { contactId, meetingId: existing?.id ?? null };
  }

  const values = {
    title: booking.title,
    contact_id: contactId,
    company_id: known?.company_id ?? null,
    start_at: new Date(booking.startAt).toISOString(),
    end_at: booking.endAt ? new Date(booking.endAt).toISOString() : null,
    location: booking.location,
    status: "scheduled",
    source: booking.source,
    external_id: booking.externalId,
    attendees: [
      {
        email: booking.email,
        name: [booking.firstName, booking.lastName].filter(Boolean).join(" "),
      },
    ],
  };
  if (existing) {
    await records.update(actor, "meetings", existing.id, values);
    return { contactId, meetingId: existing.id };
  }
  const [openDeal] = await database
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        sql`${contactId} = any(${deals.contact_ids})`,
        notInArray(deals.stage, CLOSED_STAGES),
      ),
    )
    .orderBy(desc(deals.updated_at))
    .limit(1);
  const meeting = await records.create(actor, "meetings", {
    ...values,
    deal_id: openDeal?.id ?? null,
    sales_id: host?.id ?? null,
  });
  if (booking.notes && contactId) {
    await records.create(actor, "contact_notes", {
      contact_id: contactId,
      text: `Booked "${booking.title}". ${booking.notes}`,
      sales_id: host?.id ?? null,
    });
  }
  return { contactId, meetingId: Number(meeting?.id) };
}
