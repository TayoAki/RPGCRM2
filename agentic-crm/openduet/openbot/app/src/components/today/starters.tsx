import {
  IconChartBar,
  IconFileImport,
  IconFileText,
  IconUserPlus,
  type TablerIcon,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { primaryBot } from "@/lib/agents/primary-bot";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { startTaskMutationOptions } from "@/lib/tasks/mutations";
import { queryClient } from "@/query-client";

export type StarterId = "notes" | "pipeline" | "intro" | "import";

export type Starter = {
  title: string;
  line: string;
  icon: TablerIcon;
  field: string;
  placeholder: string;
  // What the Bot is asked, followed by what the person pasted.
  ask: string;
};

export const STARTERS: Record<StarterId, Starter> = {
  notes: {
    title: "Turn notes into follow-ups",
    line: "Paste notes. Get a clear action list.",
    icon: IconFileText,
    field: "Your notes",
    placeholder:
      "Call with Maya at Acme: wants pricing by Friday, loop in Sam on the design…",
    ask: "Turn these notes into a clear list of follow-ups. For each one, say who it's with, what to do and by when. Then offer to add them to the CRM as follow-ups on the right contacts.",
  },
  pipeline: {
    title: "Shape your sales pipeline",
    line: "Choose stages that fit your process.",
    icon: IconChartBar,
    field: "How do you sell?",
    placeholder:
      "Leads come from referrals. We do a discovery call, send a proposal, then negotiate…",
    ask: "Help me set up my sales pipeline. Propose deal stages that fit how I sell, and for each stage say what moves a deal into the next one.",
  },
  intro: {
    title: "Draft a warm introduction",
    line: "Start with a person and a purpose.",
    icon: IconUserPlus,
    field: "Who is it to, and why?",
    placeholder:
      "Introduce Maya Chen at Acme to Sam, our designer, about their rebrand",
    ask: "Draft a short, warm introduction email. Look the people up in the CRM first if they're there, and keep it under 120 words.",
  },
  import: {
    title: "Bring in your contacts",
    line: "Paste a list and your Bot adds them.",
    icon: IconFileImport,
    field: "Your list",
    placeholder: "Name, email, company\nMaya Chen, maya@acme.com, Acme",
    ask: "Add these people to the CRM as contacts, with their companies. Skip anyone who's already there, and tell me who you added.",
  },
};

/** Paste something in and a Bot starts on it as a task, which opens when it starts. */
export function StarterDialog({
  starter,
  onClose,
}: {
  starter: StarterId | null;
  onClose: () => void;
}) {
  const bot = primaryBot(useQuery(agentListQueryOptions()).data);
  const navigate = useNavigate();
  const start = useMutation(startTaskMutationOptions(queryClient));
  const [text, setText] = useState("");
  const fieldId = useId();
  const shown = starter ? STARTERS[starter] : null;
  const close = () => {
    setText("");
    start.reset();
    onClose();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!bot || !shown || !text.trim()) return;
    start.mutate(
      { botId: bot.id, instruction: `${shown.ask}\n\n${text.trim()}` },
      {
        onSuccess: (task) => {
          close();
          void navigate({ to: "/tasks/$taskId", params: { taskId: task.id } });
        },
      },
    );
  };
  return (
    <Dialog onOpenChange={(open) => (open ? null : close())} open={!!shown}>
      {shown ? (
        <DialogContent className="max-w-lg">
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div>
              <DialogTitle>{shown.title}</DialogTitle>
              <DialogDescription>{shown.line}</DialogDescription>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                className="type-label font-medium text-duet-ink"
                htmlFor={fieldId}
              >
                {shown.field}
              </label>
              <Textarea
                autoFocus
                className="min-h-36"
                id={fieldId}
                onChange={(event) => setText(event.target.value)}
                placeholder={shown.placeholder}
                value={text}
              />
            </div>
            {start.isError ? (
              <p className="type-caption text-duet-red" role="alert">
                {start.error.message}
              </p>
            ) : null}
            {!bot ? (
              <p className="type-caption text-duet-ink-2">
                There's no Bot to do this yet.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button onClick={close} type="button" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={!bot || !text.trim() || start.isPending}
                type="submit"
              >
                {start.isPending ? "Starting…" : "Start"}
              </Button>
            </div>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
