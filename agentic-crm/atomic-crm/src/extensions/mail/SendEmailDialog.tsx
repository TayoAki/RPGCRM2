import { useMutation } from "@tanstack/react-query";
import { type Identifier, useNotify, useRefresh } from "ra-core";
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
import { Textarea } from "@/components/ui/textarea";

import { crmApi, errorMessage } from "../api";
import type { Email } from "../types";

export type EmailDraft = {
  to: string;
  subject?: string;
  body?: string;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
};

const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

export const SendEmailDialog = ({
  draft,
  onClose,
}: {
  draft: EmailDraft;
  onClose: () => void;
}) => {
  const [to, setTo] = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body ?? "");
  const [later, setLater] = useState("");
  const notify = useNotify();
  const refresh = useRefresh();

  const send = useMutation({
    mutationFn: (asDraft: boolean) =>
      crmApi<Email>("/mail/emails", {
        method: "POST",
        body: {
          to_address: to,
          subject,
          body,
          contact_id: draft.contact_id ?? null,
          deal_id: draft.deal_id ?? null,
          ...(later && !asDraft
            ? { send_at: new Date(later).toISOString() }
            : {}),
          ...(asDraft ? { draft: true } : {}),
        },
      }),
    onSuccess: (email) => {
      if (email.status === "failed") {
        notify(`Not sent: ${email.error}`, { type: "error" });
      } else {
        notify(
          email.status === "draft"
            ? "Saved as a draft."
            : email.status === "scheduled"
              ? "It will go out at the time you chose."
              : "Sent.",
        );
      }
      refresh();
      onClose();
    },
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>New email</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email-to">To</Label>
            <Input
              id="email-to"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              rows={10}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="email-later">Send later (optional)</Label>
            <Input
              id="email-later"
              type="datetime-local"
              min={localInput(new Date())}
              value={later}
              onChange={(event) => setLater(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={send.isPending}
              onClick={() => send.mutate(true)}
            >
              Save draft
            </Button>
            <Button type="submit" disabled={send.isPending || !to || !subject}>
              {later ? "Schedule" : send.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
