import { useNotify, useRefresh, useUpdate } from "ra-core";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

import { useAutomationInfo } from "../queries";
import type { Meeting } from "../types";

const NO_SHOW = "No show";

/**
 * The call outcome form. Saving it marks the meeting done (or a no-show); automations take the
 * outcome from there, such as writing the proposal or sending the right follow-up.
 */
export const OutcomeDialog = ({
  meeting,
  onClose,
}: {
  meeting: Meeting;
  onClose: () => void;
}) => {
  const { data: info } = useAutomationInfo();
  const outcomes = info?.meeting_outcomes ?? [];
  const [outcome, setOutcome] = useState(meeting.outcome ?? "");
  const [notes, setNotes] = useState(meeting.outcome_notes ?? "");
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update(
      "meetings",
      {
        id: meeting.id,
        data: {
          outcome,
          outcome_notes: notes || null,
          status: outcome === NO_SHOW ? "no_show" : "completed",
        },
        previousData: meeting,
      },
      {
        onSuccess: () => {
          notify("Outcome saved.");
          refresh();
          onClose();
        },
        onError: (error) =>
          notify(error instanceof Error ? error.message : "Couldn't save.", {
            type: "error",
          }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>How did {meeting.title} go?</DialogTitle>
            <DialogDescription>
              Your automations use the outcome, for example to write a proposal
              or send the right follow-up.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={outcome}
            onValueChange={setOutcome}
            aria-label="Outcome"
          >
            {outcomes.map((choice) => (
              <div key={choice} className="flex items-center gap-2">
                <RadioGroupItem value={choice} id={`outcome-${choice}`} />
                <Label htmlFor={`outcome-${choice}`}>{choice}</Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex flex-col gap-1">
            <Label htmlFor="outcome-notes">Notes</Label>
            <Textarea
              id="outcome-notes"
              rows={5}
              placeholder="What they need, budget, timing, who decides…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !outcome}>
              Save outcome
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
