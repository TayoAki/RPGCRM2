import { z } from "zod";
import { endOfDayIn } from "../plugins/google-workspace-rest";

/*
 * The person's inbox and today's calendar through Composio's Gmail and Google Calendar apps, for the
 * morning brief when the built-in Google connector isn't set up. Same plugin store, same grants:
 * the Bot needs these two tools granted and the person needs both apps connected.
 */

export const COMPOSIO_GMAIL = "composio-gmail/GMAIL_FETCH_EMAILS";
export const COMPOSIO_CALENDAR =
  "composio-googlecalendar/GOOGLECALENDAR_EVENTS_LIST";

type Call = (
  ref: string,
  args: Record<string, unknown>,
) => Promise<{ text: string; isError: boolean }>;

// What the Composio transport says for an empty answer (plugins/composio.ts, resultOf).
const NOTHING = "The action returned nothing.";
// Metadata only, so a page stays well under the transport's 20,000-character cap.
const PAGE = 25;

const message = z.object({
  messageId: z.string(),
  threadId: z.string().nullish(),
  sender: z.string().nullish(),
  to: z.string().nullish(),
  subject: z.string().nullish(),
  messageTimestamp: z.string().nullish(),
  labelIds: z.array(z.unknown()).nullish(),
  preview: z.object({ body: z.string().nullish() }).passthrough().nullish(),
  messageText: z.string().nullish(),
});
const page = z.object({
  messages: z.array(message).nullish(),
  nextPageToken: z.string().nullish(),
  resultSizeEstimate: z.number().nullish(),
});

const when = z.object({
  dateTime: z.string().nullish(),
  date: z.string().nullish(),
});
const events = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        summary: z.string().nullish(),
        status: z.string().nullish(),
        location: z.string().nullish(),
        start: when.nullish(),
        end: when.nullish(),
      }),
    )
    .nullish(),
  timeZone: z.string().nullish(),
});

function answer(result: { text: string; isError: boolean }): unknown {
  if (result.isError) throw new Error(result.text);
  if (result.text === NOTHING) return {};
  if (result.text.endsWith("[truncated]")) {
    throw new Error("Composio's answer was too long to read.");
  }
  return JSON.parse(result.text);
}

// Addresses split on commas outside quotes, so "Doe, Jane" <jane@x> stays one.
const recipients = (to: string | null | undefined) =>
  (to ?? "")
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((each) => each.trim())
    .filter(Boolean);

const timeOf = (date: string) => {
  const at = Date.parse(date);
  return Number.isNaN(at) ? 0 : at;
};

/** Gmail search results through Composio, newest first, in the shape the built-in search returns. */
export async function composioInbox(call: Call, query: string, max: number) {
  const found: {
    id: string;
    threadId: string;
    from: string;
    to: string[];
    cc: string[];
    subject: string;
    date: string;
    snippet: string;
    labels: string[];
    headers: Record<string, string>;
  }[] = [];
  let estimate: number | null = null;
  let token: string | undefined;
  do {
    const read = page.parse(
      answer(
        await call(COMPOSIO_GMAIL, {
          query,
          max_results: Math.min(PAGE, max - found.length),
          verbose: false,
          include_payload: false,
          ...(token ? { page_token: token } : {}),
        }),
      ),
    );
    estimate ??= read.resultSizeEstimate ?? null;
    for (const each of read.messages ?? []) {
      found.push({
        id: each.messageId,
        threadId: each.threadId ?? each.messageId,
        from: each.sender ?? "",
        to: recipients(each.to),
        cc: [],
        subject: each.subject ?? "",
        date: each.messageTimestamp ?? "",
        snippet: each.preview?.body ?? each.messageText?.slice(0, 300) ?? "",
        labels: (each.labelIds ?? []).filter(
          (label): label is string => typeof label === "string",
        ),
        headers: {},
      });
    }
    token = read.messages?.length ? read.nextPageToken || undefined : undefined;
  } while (token && found.length < max);
  found.sort((one, other) => timeOf(other.date) - timeOf(one.date));
  return { messages: found.slice(0, max), resultSizeEstimate: estimate };
}

/** What's left of today on the person's main calendar through Composio, earliest first. */
export async function composioToday(call: Call, now: Date) {
  const read = events.parse(
    answer(
      await call(COMPOSIO_CALENDAR, {
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: new Date(now.getTime() + 86_400_000).toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 50,
      }),
    ),
  );
  const midnight = endOfDayIn(now, read.timeZone ?? "UTC").getTime();
  return (read.items ?? [])
    .filter((event) => event.status !== "cancelled")
    .map((event) => ({
      id: event.id,
      summary: event.summary || "(no title)",
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
      ...(event.location ? { location: event.location } : {}),
    }))
    .filter((event) => timeOf(event.start) < midnight);
}
