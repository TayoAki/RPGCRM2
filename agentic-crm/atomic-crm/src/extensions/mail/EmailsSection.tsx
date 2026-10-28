import { useMutation } from "@tanstack/react-query";
import { type Identifier, useGetList, useNotify, useRefresh } from "ra-core";
import { ArrowDownLeft, ArrowUpRight, Mail } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { crmApi, errorMessage } from "../api";
import type { Email } from "../types";
import { type EmailDraft, SendEmailDialog } from "./SendEmailDialog";

const STATUS_LABEL: Record<Email["status"], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  received: "Received",
};

const EmailItem = ({ email }: { email: Email }) => {
  const [open, setOpen] = useState(false);
  const notify = useNotify();
  const refresh = useRefresh();
  const act = useMutation({
    mutationFn: (action: "send" | "remove") =>
      action === "send"
        ? crmApi<Email>(`/mail/emails/${email.id}/send`, { method: "POST" })
        : crmApi(`/mail/emails/${email.id}`, { method: "DELETE" }),
    onSuccess: (result) => {
      const failed = (result as Email | null)?.status === "failed";
      notify(failed ? `Not sent: ${(result as Email).error}` : "Done.", {
        type: failed ? "error" : "info",
      });
      refresh();
    },
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });
  const when = email.sent_at ?? email.send_at ?? email.created_at;
  const incoming = email.direction === "in";

  return (
    <li className="border-b last:border-0 py-2">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setOpen(!open)}
      >
        {incoming ? (
          <ArrowDownLeft
            className="size-4 mt-0.5 text-muted-foreground"
            aria-label="Received"
          />
        ) : (
          <ArrowUpRight
            className="size-4 mt-0.5 text-muted-foreground"
            aria-label="Sent"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {email.subject || "(no subject)"}
            </span>
            {email.status !== "sent" && email.status !== "received" ? (
              <Badge
                variant={
                  email.status === "failed" ? "destructive" : "secondary"
                }
              >
                {STATUS_LABEL[email.status]}
              </Badge>
            ) : null}
            {email.workflow_run_id ? (
              <Badge variant="outline">Automation</Badge>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">
            {incoming ? `From ${email.from_address}` : `To ${email.to_address}`}{" "}
            · <RelativeDate date={when} />
          </div>
        </div>
      </button>
      {open ? (
        <div className="mt-2 ml-6 space-y-2">
          <p className="text-sm whitespace-pre-line">{email.body}</p>
          {email.error ? (
            <p className="text-sm text-destructive">{email.error}</p>
          ) : null}
          {["draft", "failed", "scheduled"].includes(email.status) ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                type="button"
                disabled={act.isPending}
                onClick={() => act.mutate("send")}
              >
                {email.status === "failed" ? "Try again" : "Send now"}
              </Button>
              {email.status !== "failed" ? (
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  disabled={act.isPending}
                  onClick={() => act.mutate("remove")}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
};

/** Mail with a contact or about a deal, newest first, and a way to write more. */
export const EmailsSection = ({
  filter,
  draft,
}: {
  filter: { contact_id?: Identifier; deal_id?: Identifier };
  draft: EmailDraft;
}) => {
  const [writing, setWriting] = useState(false);
  const { data: emails = [], total } = useGetList<Email>("emails", {
    filter,
    sort: { field: "created_at", order: "DESC" },
    pagination: { page: 1, perPage: 20 },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Mail className="size-4" /> Emails {total ? `(${total})` : ""}
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setWriting(true)}
        >
          Write an email
        </Button>
      </div>
      {emails.length ? (
        <ul>
          {emails.map((email) => (
            <EmailItem key={email.id} email={email} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No emails yet.</p>
      )}
      {writing ? (
        <SendEmailDialog draft={draft} onClose={() => setWriting(false)} />
      ) : null}
    </div>
  );
};
