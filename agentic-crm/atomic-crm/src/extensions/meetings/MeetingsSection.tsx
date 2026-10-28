import { type Identifier, useGetList } from "ra-core";
import { CalendarClock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import type { Meeting } from "../types";
import { MeetingDialog } from "./MeetingDialog";
import { MeetingItem } from "./MeetingItem";

/** A contact's or a deal's meetings: what's coming, then what happened. */
export const MeetingsSection = ({
  filter,
  links,
}: {
  filter: { contact_id?: Identifier; deal_id?: Identifier };
  links: {
    contact_id?: Identifier | null;
    deal_id?: Identifier | null;
    company_id?: Identifier | null;
  };
}) => {
  const [adding, setAdding] = useState(false);
  const { data: meetings = [] } = useGetList<Meeting>("meetings", {
    filter,
    sort: { field: "start_at", order: "DESC" },
    pagination: { page: 1, perPage: 50 },
  });
  const now = Date.now();
  const upcoming = meetings
    .filter((meeting) => Date.parse(meeting.start_at) >= now)
    .reverse();
  const past = meetings.filter((meeting) => Date.parse(meeting.start_at) < now);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2">
          <CalendarClock className="size-4" /> Meetings
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
        >
          Add a meeting
        </Button>
      </div>
      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meetings yet.</p>
      ) : (
        <ul>
          {[...upcoming, ...past].map((meeting) => (
            <MeetingItem key={meeting.id} meeting={meeting} />
          ))}
        </ul>
      )}
      {adding ? (
        <MeetingDialog links={links} onClose={() => setAdding(false)} />
      ) : null}
    </div>
  );
};
