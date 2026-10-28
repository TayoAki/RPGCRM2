import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { crmApi, errorMessage } from "../api";
import { automationInfoKey, mailboxesKey, useMailboxes } from "../queries";
import { MailboxDialog, type MailboxScope } from "./MailboxDialog";

/** One mailbox, with what it sends as, whether it reads replies, and buttons to change it. */
export const MailboxCard = ({ scope }: { scope: MailboxScope }) => {
  const { data } = useMailboxes();
  const mailbox = data?.[scope] ?? null;
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const notify = useNotify();

  const test = useMutation({
    mutationFn: () =>
      crmApi<{ ok: boolean; problem: string | null }>(
        `/mail/mailboxes/${scope}/test`,
        {
          method: "POST",
        },
      ),
    onSuccess: (result) =>
      result.ok
        ? notify("The mail server accepted the sign-in.")
        : notify(`The mail server said: ${result.problem}`, { type: "error" }),
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });
  const remove = useMutation({
    mutationFn: () => crmApi(`/mail/mailboxes/${scope}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: mailboxesKey });
      await queryClient.invalidateQueries({ queryKey: automationInfoKey });
    },
  });

  return (
    <Card id={scope === "shared" ? "mail" : undefined}>
      <CardContent className="space-y-3">
        <h2 className="text-xl font-semibold text-muted-foreground">
          {scope === "mine" ? "Your mailbox" : "Shared mailbox"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {scope === "mine"
            ? "Emails you send from the CRM, and automations about your records, go out from here."
            : "Used by everyone who hasn't connected their own mailbox."}
        </p>
        {mailbox ? (
          <div className="text-sm space-y-1">
            <div>
              Sends as{" "}
              <strong>
                {mailbox.from_name
                  ? `${mailbox.from_name} <${mailbox.from_address}>`
                  : mailbox.from_address}
              </strong>{" "}
              through {mailbox.smtp_host}.
            </div>
            <div className="text-muted-foreground">
              {mailbox.imap_host ? (
                mailbox.imap_error ? (
                  `Couldn't read replies: ${mailbox.imap_error}`
                ) : mailbox.imap_checked_at ? (
                  <>
                    Reads replies from {mailbox.imap_host}, last checked{" "}
                    <RelativeDate date={mailbox.imap_checked_at} />.
                  </>
                ) : (
                  `Reads replies from ${mailbox.imap_host}.`
                )
              ) : (
                "Doesn't read replies."
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm">No mailbox connected.</p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            {mailbox ? "Change" : "Connect a mailbox"}
          </Button>
          {mailbox ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={test.isPending}
                onClick={() => test.mutate()}
              >
                {test.isPending ? "Testing…" : "Test"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => remove.mutate()}
              >
                Disconnect
              </Button>
            </>
          ) : null}
        </div>
        {editing ? (
          <MailboxDialog
            scope={scope}
            mailbox={mailbox}
            open
            onOpenChange={setEditing}
          />
        ) : null}
      </CardContent>
    </Card>
  );
};
