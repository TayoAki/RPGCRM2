/* eslint-disable react-refresh/only-export-components */
import { CalendarClock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Meeting } from "../types";
import { MeetingDialog } from "./MeetingDialog";
import { OutcomeDialog } from "./OutcomeDialog";

const STATUS: Record<Meeting["status"], string> = {
  scheduled: "Scheduled",
  completed: "Done",
  no_show: "No-show",
  canceled: "Canceled",
};

const SOURCE: Record<string, string> = {
  calcom: "Cal.com",
  calendly: "Calendly",
  webhook: "Booked online",
};

export const formatMeetingTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

export const MeetingItem = ({
  meeting,
  children,
}: {
  meeting: Meeting;
  children?: ReactNode;
}) => {
  const [dialog, setDialog] = useState<"outcome" | "edit" | null>(null);
  const past = Date.parse(meeting.start_at) < Date.now();
  const needsOutcome = past && meeting.status === "scheduled";

  return (
    <li className="flex items-start gap-2 py-2 border-b last:border-0">
      <CalendarClock className="size-4 mt-0.5 text-muted-foreground" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{meeting.title}</span>
          <Badge
            variant={meeting.status === "canceled" ? "outline" : "secondary"}
          >
            {STATUS[meeting.status]}
          </Badge>
          {meeting.outcome ? (
            <Badge variant="outline">{meeting.outcome}</Badge>
          ) : null}
          {SOURCE[meeting.source] ? (
            <span className="text-xs text-muted-foreground">
              {SOURCE[meeting.source]}
            </span>
          ) : null}
        </div>
        <div className="text-muted-foreground">
          {formatMeetingTime(meeting.start_at)}
          {meeting.location ? (
            <>
              {" · "}
              {/^https?:\/\//.test(meeting.location) ? (
                <a
                  href={meeting.location}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Join
                </a>
              ) : (
                meeting.location
              )}
            </>
          ) : null}
        </div>
        {children}
        {meeting.outcome_notes ? (
          <p className="mt-1 whitespace-pre-line">{meeting.outcome_notes}</p>
        ) : null}
      </div>
      <div className="flex gap-1">
        {meeting.status !== "canceled" ? (
          <Button
            type="button"
            size="sm"
            variant={needsOutcome ? "default" : "ghost"}
            onClick={() => setDialog("outcome")}
          >
            {meeting.outcome ? "Change outcome" : "Log outcome"}
          </Button>
        ) : null}
        {!past ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDialog("edit")}
          >
            Change
          </Button>
        ) : null}
      </div>
      {dialog === "outcome" ? (
        <OutcomeDialog meeting={meeting} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "edit" ? (
        <MeetingDialog
          meeting={meeting}
          links={{}}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </li>
  );
};
