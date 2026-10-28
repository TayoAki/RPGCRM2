import {
  type Identifier,
  useCreate,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Meeting } from "../types";

const localInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const MINUTE = 60_000;

/** Adds a meeting for a contact or a deal, or changes one. */
export const MeetingDialog = ({
  meeting,
  links,
  onClose,
}: {
  meeting?: Meeting;
  links: {
    contact_id?: Identifier | null;
    deal_id?: Identifier | null;
    company_id?: Identifier | null;
  };
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(meeting?.title ?? "Call");
  const [start, setStart] = useState(localInput(meeting?.start_at));
  const [minutes, setMinutes] = useState(() =>
    meeting?.end_at
      ? String(
          Math.round(
            (Date.parse(meeting.end_at) - Date.parse(meeting.start_at)) /
              MINUTE,
          ),
        )
      : "30",
  );
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [create, { isPending: creating }] = useCreate();
  const [update, { isPending: updating }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const startAt = new Date(start);
    const data = {
      title,
      start_at: startAt.toISOString(),
      end_at: new Date(
        startAt.getTime() + Number(minutes || 0) * MINUTE,
      ).toISOString(),
      location: location || null,
    };
    const options = {
      onSuccess: () => {
        refresh();
        onClose();
      },
      onError: (error: unknown) =>
        notify(error instanceof Error ? error.message : "Couldn't save.", {
          type: "error",
        }),
    };
    if (meeting) {
      update(
        "meetings",
        { id: meeting.id, data, previousData: meeting },
        options,
      );
    } else {
      create("meetings", { data: { ...links, ...data } }, options);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>
              {meeting ? "Change meeting" : "Add a meeting"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="meeting-start">Starts</Label>
              <Input
                id="meeting-start"
                type="datetime-local"
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="meeting-minutes">Minutes</Label>
              <Input
                id="meeting-minutes"
                type="number"
                min={0}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="meeting-location">
              Where (an address or a video link)
            </Label>
            <Input
              id="meeting-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating || !start}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
