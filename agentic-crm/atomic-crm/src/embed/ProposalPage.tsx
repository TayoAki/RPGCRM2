import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Markdown } from "../components/atomic-crm/misc/Markdown";

type PublicProposal = {
  title: string;
  body: string;
  amount: number | null;
  currency: string;
  status: "viewed" | "scheduled" | "accepted" | "declined";
  valid_until: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  client: string | null;
  from: { name: string | null; business: string | null };
};

const API = "/api/crm-public/proposals";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(
    new Date(iso),
  );

/**
 * What a client sees on their proposal link, with no sign-in: the proposal, and a way to accept or
 * decline it once.
 */
export const ProposalPage = ({ token }: { token: string }) => {
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [missing, setMissing] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setProposal((await response.json()).data);
      })
      .catch(() => !controller.signal.aborted && setMissing(true));
    return () => controller.abort();
  }, [token]);

  const answer = async (event: FormEvent, choice: "accept" | "decline") => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const response = await fetch(
      `${API}/${encodeURIComponent(token)}/${choice}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(choice === "accept" ? { name } : { name, reason }),
      },
    ).catch(() => null);
    setSaving(false);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setError(body?.error ?? "That didn't go through. Try again.");
      return;
    }
    const now = new Date().toISOString();
    setProposal((current) =>
      current
        ? {
            ...current,
            status: choice === "accept" ? "accepted" : "declined",
            ...(choice === "accept"
              ? { accepted_at: now }
              : { declined_at: now }),
          }
        : current,
    );
  };

  if (missing) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">
          This proposal link doesn't work anymore. Ask the sender for a new one.
        </p>
      </main>
    );
  }
  if (!proposal) return null;

  const answered =
    proposal.status === "accepted" || proposal.status === "declined";
  const expired =
    !answered &&
    proposal.valid_until !== null &&
    proposal.valid_until < new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {[proposal.from.business, proposal.from.name]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <h1 className="text-3xl font-bold">{proposal.title}</h1>
          <span className="text-sm text-muted-foreground">
            {proposal.client ? `For ${proposal.client}` : null}
            {proposal.amount
              ? ` · ${new Intl.NumberFormat(undefined, { style: "currency", currency: proposal.currency, maximumFractionDigits: 0 }).format(proposal.amount)}`
              : null}
            {proposal.valid_until
              ? ` · Valid until ${formatDate(proposal.valid_until)}`
              : null}
          </span>
        </header>
        <Card>
          <CardContent>
            <Markdown>{proposal.body}</Markdown>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-3">
            {proposal.status === "accepted" ? (
              <p className="font-medium">
                Accepted
                {proposal.accepted_at
                  ? ` on ${formatDate(proposal.accepted_at)}`
                  : ""}
                . Thank you!
              </p>
            ) : proposal.status === "declined" ? (
              <p className="font-medium">
                Declined
                {proposal.declined_at
                  ? ` on ${formatDate(proposal.declined_at)}`
                  : ""}
                . Thanks for letting us know.
              </p>
            ) : expired ? (
              <p>This proposal has expired. Ask the sender for a new one.</p>
            ) : declining ? (
              <form
                onSubmit={(event) => answer(event, "decline")}
                className="flex flex-col gap-3"
              >
                <Input
                  aria-label="Your name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Textarea
                  aria-label="Why (optional)"
                  placeholder="Anything we should know? (optional)"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="destructive" disabled={saving}>
                    Decline the proposal
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeclining(false)}
                  >
                    Back
                  </Button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={(event) => answer(event, "accept")}
                className="flex flex-col gap-3"
              >
                <p>To accept, type your name and press Accept.</p>
                <Input
                  aria-label="Your name"
                  placeholder="Your name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || !name.trim()}>
                    Accept the proposal
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setDeclining(true)}
                  >
                    Decline
                  </Button>
                </div>
              </form>
            )}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
