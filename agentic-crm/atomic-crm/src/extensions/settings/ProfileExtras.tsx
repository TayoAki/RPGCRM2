import { KeyRound } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { MailboxCard } from "../mail/MailboxCard";

/** What this fork adds to a person's profile: their mailbox and their API keys. */
export const ProfileExtras = () => (
  <>
    <MailboxCard scope="mine" />
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">API keys</h2>
          <p className="text-sm text-muted-foreground">
            Let other software read and change the CRM as you.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/settings/api">
            <KeyRound className="size-4" />
            API keys
          </Link>
        </Button>
      </CardContent>
    </Card>
  </>
);
