import { useNotify, useRefresh, useUpdate } from "ra-core";
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

import { Markdown } from "../../components/atomic-crm/misc/Markdown";
import { RichTextEditor } from "../editor/RichTextEditor";
import type { Proposal } from "../types";

/** Reading and changing a proposal before it goes out. */
export const ProposalDialog = ({
  proposal,
  onClose,
}: {
  proposal: Proposal;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(proposal.title);
  const [body, setBody] = useState(proposal.body);
  const [amount, setAmount] = useState(
    proposal.amount == null ? "" : String(proposal.amount),
  );
  const [validUntil, setValidUntil] = useState(proposal.valid_until ?? "");
  const [update, { isPending }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const locked = ["sent", "viewed", "accepted", "declined"].includes(
    proposal.status,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update(
      "proposals",
      {
        id: proposal.id,
        data: {
          title,
          body,
          amount: amount === "" ? null : Number(amount),
          valid_until: validUntil || null,
        },
        previousData: proposal,
      },
      {
        onSuccess: () => {
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle>{locked ? proposal.title : "Proposal"}</DialogTitle>
          </DialogHeader>
          {locked ? (
            <Markdown>{proposal.body}</Markdown>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <Label htmlFor="proposal-title">Title</Label>
                  <Input
                    id="proposal-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="proposal-amount">Amount</Label>
                  <Input
                    id="proposal-amount"
                    type="number"
                    min={0}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="proposal-valid">Valid until</Label>
                  <Input
                    id="proposal-valid"
                    type="date"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <RichTextEditor
                  label="Proposal"
                  value={body}
                  onChange={setBody}
                />
                <p className="text-xs text-muted-foreground">
                  Fill in anything in [square brackets] before sending.
                </p>
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {locked ? "Close" : "Cancel"}
            </Button>
            {locked ? null : (
              <Button type="submit" disabled={isPending}>
                Save
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
