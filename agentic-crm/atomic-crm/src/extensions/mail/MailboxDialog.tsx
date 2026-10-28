import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { crmApi, errorMessage } from "../api";
import { automationInfoKey, mailboxesKey } from "../queries";
import type { Mailbox } from "../types";

type Preset = { smtp: [string, number, boolean]; imap: [string, number] };

// Where common providers take SMTP and IMAP. Each needs an app password, not the account's own.
const PRESETS: Record<string, Preset> = {
  Gmail: { smtp: ["smtp.gmail.com", 465, true], imap: ["imap.gmail.com", 993] },
  "Outlook or Microsoft 365": {
    smtp: ["smtp.office365.com", 587, false],
    imap: ["outlook.office365.com", 993],
  },
  "Yahoo Mail": {
    smtp: ["smtp.mail.yahoo.com", 465, true],
    imap: ["imap.mail.yahoo.com", 993],
  },
  iCloud: {
    smtp: ["smtp.mail.me.com", 587, false],
    imap: ["imap.mail.me.com", 993],
  },
  Fastmail: {
    smtp: ["smtp.fastmail.com", 465, true],
    imap: ["imap.fastmail.com", 993],
  },
  Zoho: { smtp: ["smtp.zoho.com", 465, true], imap: ["imap.zoho.com", 993] },
};

type Fields = {
  from_name: string;
  from_address: string;
  smtp_host: string;
  smtp_port: string;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  imap_host: string;
  imap_port: string;
  imap_user: string;
  imap_password: string;
};

const fieldsFrom = (mailbox: Mailbox | null): Fields => ({
  from_name: mailbox?.from_name ?? "",
  from_address: mailbox?.from_address ?? "",
  smtp_host: mailbox?.smtp_host ?? "",
  smtp_port: String(mailbox?.smtp_port ?? 587),
  smtp_secure: mailbox?.smtp_secure ?? false,
  smtp_user: mailbox?.smtp_user ?? "",
  smtp_password: "",
  imap_host: mailbox?.imap_host ?? "",
  imap_port: String(mailbox?.imap_port ?? 993),
  imap_user: mailbox?.imap_user ?? "",
  imap_password: "",
});

export type MailboxScope = "mine" | "shared";

export const MailboxDialog = ({
  scope,
  mailbox,
  open,
  onOpenChange,
}: {
  scope: MailboxScope;
  mailbox: Mailbox | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(mailbox));
  const queryClient = useQueryClient();
  const notify = useNotify();
  const set =
    <TKey extends keyof Fields>(key: TKey) =>
    (value: Fields[TKey]) =>
      setFields((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      crmApi(`/mail/mailboxes/${scope}`, {
        method: "PUT",
        body: {
          ...fields,
          smtp_port: Number(fields.smtp_port),
          imap_port: Number(fields.imap_port),
          smtp_password: fields.smtp_password || undefined,
          imap_password: fields.imap_password || undefined,
          imap_host: fields.imap_host || null,
          imap_user: fields.imap_user || null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: mailboxesKey });
      await queryClient.invalidateQueries({ queryKey: automationInfoKey });
      notify("Mailbox saved.");
      onOpenChange(false);
    },
    onError: (error) => notify(errorMessage(error), { type: "error" }),
  });

  const usePreset = (name: string) => {
    const preset = PRESETS[name];
    if (!preset) return;
    setFields((current) => ({
      ...current,
      smtp_host: preset.smtp[0],
      smtp_port: String(preset.smtp[1]),
      smtp_secure: preset.smtp[2],
      imap_host: preset.imap[0],
      imap_port: String(preset.imap[1]),
      smtp_user: current.smtp_user || current.from_address,
      imap_user: current.imap_user || current.from_address,
    }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const field = (
    key: keyof Fields,
    label: string,
    type = "text",
    placeholder?: string,
  ) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`mailbox-${key}`}>{label}</Label>
      <Input
        id={`mailbox-${key}`}
        type={type}
        value={String(fields[key])}
        placeholder={placeholder}
        onChange={(event) => set(key)(event.target.value as never)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {scope === "mine" ? "Your mailbox" : "Shared mailbox"}
            </DialogTitle>
            <DialogDescription>
              Emails go out from this address. Most providers need an app
              password, which you make in your account's security settings.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label>Provider</Label>
            <Select onValueChange={usePreset}>
              <SelectTrigger aria-label="Provider">
                <SelectValue placeholder="Fill in the servers for…" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PRESETS).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("from_name", "Name people see")}
            {field("from_address", "Email address", "email")}
          </div>
          <h3 className="font-medium">Sending (SMTP)</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">{field("smtp_host", "Server")}</div>
            {field("smtp_port", "Port", "number")}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="mailbox-smtp_secure"
              checked={fields.smtp_secure}
              onCheckedChange={set("smtp_secure")}
            />
            <Label htmlFor="mailbox-smtp_secure">
              TLS from the start (usually port 465)
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("smtp_user", "User name")}
            {field(
              "smtp_password",
              "App password",
              "password",
              mailbox?.has_smtp_password
                ? "Saved. Type to change it."
                : undefined,
            )}
          </div>
          <h3 className="font-medium">Reading replies (IMAP, optional)</h3>
          <p className="text-sm text-muted-foreground">
            With this, replies from your contacts show on their page, and
            follow-ups stop when someone answers.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">{field("imap_host", "Server")}</div>
            {field("imap_port", "Port", "number")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("imap_user", "User name")}
            {field(
              "imap_password",
              "App password",
              "password",
              mailbox?.has_imap_password
                ? "Saved. Type to change it."
                : undefined,
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
