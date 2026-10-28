import { useMutation } from "@tanstack/react-query";
import {
  type Identifier,
  useCreate,
  useGetList,
  useNotify,
  useRefresh,
  useUpdate,
} from "ra-core";
import { FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { crmApi, errorMessage } from "../api";
import { useAutomationInfo } from "../queries";
import type { Email, Proposal } from "../types";
import { ProposalDialog } from "./ProposalDialog";

const STATUS: Record<Proposal["status"], string> = {
  draft: "Draft",
  ready: "Ready to send",
  scheduled: "Scheduled",
  sent: "Sent",
  viewed: "Opened",
  accepted: "Accepted",
  declined: "Declined",
};

const proposalUrl = (token: string) =>
  `${window.location.origin}/proposal/${token}`;

const ProposalItem = ({ proposal }: { proposal: Proposal }) => {
  const [open, setOpen] = useState(false);
  const [later, setLater] = useState<string | null>(null);
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const send = useMutation({
    mutationFn: (sendAt: string | null) =>
      crmApi<Email>(`/actions/proposals/${proposal.id}/send`, {
        method: "POST",
        body: sendAt ? { send_at: sendAt } : {},
      }),
    onSuccess: (email) => {
      notify(
        email.status === "failed"
          ? `Not sent: ${email.error}`
          : email.status === "scheduled"
            ? "It will go out at the time you chose."
            : "Sent to the client.",
        { type: email.status === "failed" ? "error" : "info" },
      );
      setLater(null);
      refresh();
    },
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });
  const markReady = () =>
    update(
      "proposals",
      { id: proposal.id, data: { status: "ready" }, previousData: proposal },
      {
        onSuccess: () => {
          notify(
            "Marked ready. Your delivery automation sends it, if it's on.",
          );
          refresh();
        },
      },
    );
  const unsent = ["draft", "ready"].includes(proposal.status);

  return (
    <li className="py-2 border-b last:border-0">
      <div className="flex items-start gap-2">
        <FileText className="size-4 mt-0.5 text-muted-foreground" />
        <div className="flex-1 min-w-0 text-sm">
          <button
            type="button"
            className="font-medium underline-offset-2 hover:underline"
            onClick={() => setOpen(true)}
          >
            {proposal.title}
          </button>{" "}
          <Badge
            variant={proposal.status === "accepted" ? "default" : "secondary"}
          >
            {STATUS[proposal.status]}
          </Badge>
          <div className="text-xs text-muted-foreground">
            {proposal.accepted_at ? (
              <>
                Accepted <RelativeDate date={proposal.accepted_at} />
              </>
            ) : proposal.declined_at ? (
              <>
                Declined <RelativeDate date={proposal.declined_at} />
              </>
            ) : proposal.viewed_at ? (
              <>
                Opened <RelativeDate date={proposal.viewed_at} />
              </>
            ) : proposal.sent_at ? (
              <>
                Sent <RelativeDate date={proposal.sent_at} />
              </>
            ) : proposal.send_at ? (
              <>
                Goes out <RelativeDate date={proposal.send_at} />
              </>
            ) : (
              <>
                Changed <RelativeDate date={proposal.updated_at} />
              </>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline">
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setOpen(true)}>
              {unsent ? "Read and change" : "Read"}
            </DropdownMenuItem>
            {proposal.status === "draft" ? (
              <DropdownMenuItem onSelect={markReady}>
                Mark ready to send
              </DropdownMenuItem>
            ) : null}
            {unsent ? (
              <>
                <DropdownMenuItem onSelect={() => send.mutate(null)}>
                  Send now
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLater("")}>
                  Send later…
                </DropdownMenuItem>
              </>
            ) : null}
            {!unsent ? (
              <DropdownMenuItem
                onSelect={() =>
                  void navigator.clipboard
                    .writeText(proposalUrl(proposal.token))
                    .then(() => notify("Link copied."))
                }
              >
                Copy the client's link
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {later !== null ? (
        <div className="flex gap-2 mt-2 ml-6">
          <Input
            type="datetime-local"
            aria-label="Send at"
            value={later}
            onChange={(event) => setLater(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={!later || send.isPending}
            onClick={() => later && send.mutate(new Date(later).toISOString())}
          >
            Schedule
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLater(null)}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {open ? (
        <ProposalDialog proposal={proposal} onClose={() => setOpen(false)} />
      ) : null}
    </li>
  );
};

/** A deal's proposals, and writing a new one, by hand or with the model. */
export const ProposalsSection = ({ dealId }: { dealId: Identifier }) => {
  const { data: proposals = [] } = useGetList<Proposal>("proposals", {
    filter: { deal_id: dealId },
    sort: { field: "id", order: "DESC" },
    pagination: { page: 1, perPage: 20 },
  });
  const { data: info } = useAutomationInfo();
  const [create] = useCreate();
  const notify = useNotify();
  const refresh = useRefresh();
  const draft = useMutation({
    mutationFn: () =>
      crmApi(`/actions/deals/${dealId}/proposal`, { method: "POST", body: {} }),
    onSuccess: () => {
      notify("The proposal is drafted. Read it before it goes out.");
      refresh();
    },
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="size-4" /> Proposals
        </h3>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              create(
                "proposals",
                { data: { deal_id: dealId, title: "Proposal", body: "" } },
                { onSuccess: () => refresh() },
              )
            }
          >
            New proposal
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={draft.isPending || info?.ready.model === false}
            title={
              info?.ready.model === false ? "Needs a model key" : undefined
            }
            onClick={() => draft.mutate()}
          >
            <Sparkles className="size-4" />
            {draft.isPending ? "Writing…" : "Write with AI"}
          </Button>
        </div>
      </div>
      {proposals.length ? (
        <ul>
          {proposals.map((proposal) => (
            <ProposalItem key={proposal.id} proposal={proposal} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No proposals yet.</p>
      )}
    </div>
  );
};
