import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addPasswordPersonMutationOptions,
  issuePasswordLinkMutationOptions,
} from "@/lib/people/mutations";
import { queryClient } from "@/query-client";

function SetPasswordLink({ path, name }: { path: string; name: string }) {
  const link = `${window.location.origin}${path}`;
  const [copied, setCopied] = useState(false);
  return (
    <>
      <p className="text-muted-foreground text-sm">
        Send this link to {name}. It works once, for 3 days.
      </p>
      <div className="mt-3 flex gap-2">
        <Input aria-label="Set-password link" readOnly value={link} />
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
          size="sm"
          variant="outline"
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </>
  );
}

/** Adds somebody who signs in with email and password, then shows their set-password link. */
export function AddPersonButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const add = useMutation(addPasswordPersonMutationOptions(queryClient));

  const close = () => {
    setOpen(false);
    setName("");
    setEmail("");
    add.reset();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg">
        Add person
      </Button>
      <Dialog
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        open={open}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
            <DialogDescription>
              They sign in with their email and a password they set from your
              link.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4">
            {add.data ? (
              <SetPasswordLink name={name} path={add.data} />
            ) : (
              <form
                className="flex flex-col gap-2"
                id="add-person"
                onSubmit={(event) => {
                  event.preventDefault();
                  add.mutate({ name: name.trim(), email: email.trim() });
                }}
              >
                <Input
                  aria-label="Name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name"
                  required
                  value={name}
                />
                <Input
                  aria-label="Email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  required
                  type="email"
                  value={email}
                />
                {add.error ? (
                  <p className="text-destructive text-sm" role="alert">
                    {add.error.message}
                  </p>
                ) : null}
              </form>
            )}
          </DialogBody>
          <DialogFooter className="mt-4">
            {add.data ? (
              <Button onClick={close} size="sm">
                Done
              </Button>
            ) : (
              <>
                <Button onClick={close} size="sm" variant="ghost">
                  Cancel
                </Button>
                <Button
                  disabled={add.isPending}
                  form="add-person"
                  size="sm"
                  type="submit"
                >
                  {add.isPending ? "Adding…" : "Add"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** A new set-password link, for somebody who forgot their password or lost the first link. */
export function PasswordLinkButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const issue = useMutation(issuePasswordLinkMutationOptions());
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        disabled={issue.isPending}
        onClick={() => {
          setOpen(true);
          issue.mutate(userId);
        }}
        size="sm"
        variant="outline"
      >
        Password link
      </Button>
      <Dialog
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) issue.reset();
        }}
        open={open}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password link</DialogTitle>
            <DialogDescription>
              A new link to set a password. It signs {name} out everywhere once
              used.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4">
            {issue.data ? (
              <SetPasswordLink name={name} path={issue.data} />
            ) : issue.error ? (
              <p className="text-destructive text-sm" role="alert">
                {issue.error.message}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Making a link…</p>
            )}
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => {
                setOpen(false);
                issue.reset();
              }}
              size="sm"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
