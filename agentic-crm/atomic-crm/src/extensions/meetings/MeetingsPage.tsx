import { useGetList, useGetMany } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import type { Contact } from "../../components/atomic-crm/types";
import type { Meeting } from "../types";
import { MeetingItem } from "./MeetingItem";

const DAY = 86_400_000;

const WithContacts = ({
  meetings,
  empty,
}: {
  meetings: Meeting[];
  empty: string;
}) => {
  const ids = useMemo(
    () => [
      ...new Set(
        meetings.flatMap((meeting) =>
          meeting.contact_id ? [meeting.contact_id] : [],
        ),
      ),
    ],
    [meetings],
  );
  const { data: contacts = [] } = useGetMany<Contact>("contacts", { ids });
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));
  if (meetings.length === 0)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul>
      {meetings.map((meeting) => {
        const contact = meeting.contact_id
          ? byId.get(meeting.contact_id)
          : undefined;
        return (
          <MeetingItem key={meeting.id} meeting={meeting}>
            {contact ? (
              <Link
                to={`/contacts/${contact.id}/show`}
                className="text-sm underline"
              >
                {contact.first_name} {contact.last_name}
              </Link>
            ) : null}
          </MeetingItem>
        );
      })}
    </ul>
  );
};

/** What's coming up, and the calls that happened without an outcome logged. */
export const MeetingsPage = () => {
  // Fixed for the page's life, so the queries don't change on every render.
  const now = useMemo(() => new Date(), []);
  const { data: upcoming = [] } = useGetList<Meeting>("meetings", {
    filter: {
      "start_at@gte": now.toISOString(),
      "start_at@lt": new Date(now.getTime() + 30 * DAY).toISOString(),
      "status@neq": "canceled",
    },
    sort: { field: "start_at", order: "ASC" },
    pagination: { page: 1, perPage: 100 },
  });
  const { data: unlogged = [] } = useGetList<Meeting>("meetings", {
    filter: {
      "start_at@lt": now.toISOString(),
      "start_at@gte": new Date(now.getTime() - 60 * DAY).toISOString(),
      status: "scheduled",
    },
    sort: { field: "start_at", order: "DESC" },
    pagination: { page: 1, perPage: 100 },
  });

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4 mt-4">
      <h1 className="text-2xl font-semibold">Meetings</h1>
      {unlogged.length ? (
        <Card>
          <CardContent>
            <h2 className="font-semibold mb-2">How did these go?</h2>
            <WithContacts meetings={unlogged} empty="" />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent>
          <h2 className="font-semibold mb-2">Next 30 days</h2>
          <WithContacts meetings={upcoming} empty="Nothing booked yet." />
        </CardContent>
      </Card>
    </div>
  );
};
