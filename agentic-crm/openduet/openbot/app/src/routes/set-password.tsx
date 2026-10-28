import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MicOrb } from "@/components/duet/mic-orb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPasswordWithToken } from "@/lib/auth/client";
import { appConfig } from "@/lib/generated/application-config";
import { searchTextEntry } from "@/lib/search-text";

// The server's minimum (auth/email-password.ts), so the field says so before a round trip does.
const MIN_PASSWORD_LENGTH = 12;

// Where an admin's set-password link lands. The token works once.
export const Route = createFileRoute("/set-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    searchTextEntry("token", search.token),
  component: SetPasswordScreen,
});

function SetPasswordScreen() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(submission: React.FormEvent) {
    submission.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await setPasswordWithToken(token ?? "", password);
      setDone(true);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "That link has expired or was already used. Ask an admin for a new one.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-82 flex-col items-center">
        <MicOrb size={56} />
        <h1 className="mt-8 text-center font-medium text-2xl tracking-tight">
          {done ? "Your password is set" : "Set your password"}
        </h1>
        {done ? (
          <Button
            className="mt-8 h-10 w-full"
            render={<Link to="/sign" />}
            size="lg"
          >
            Sign in to {appConfig.brand.productName}
          </Button>
        ) : !token ? (
          <p className="mt-8 text-center text-muted-foreground text-sm">
            This link is incomplete. Ask an admin for a new one.
          </p>
        ) : (
          <form
            className="mt-8 flex w-full flex-col gap-2"
            onSubmit={handleSubmit}
          >
            <Input
              aria-label="New password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              required
              type="password"
              value={password}
            />
            <Input
              aria-label="Repeat the password"
              autoComplete="new-password"
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Repeat the password"
              required
              type="password"
              value={confirmation}
            />
            <p className="text-muted-foreground text-xs">
              Use at least {MIN_PASSWORD_LENGTH} characters.
            </p>
            <Button
              className="h-10 w-full"
              disabled={saving}
              size="lg"
              type="submit"
            >
              {saving ? "Saving…" : "Set password"}
            </Button>
          </form>
        )}
        {error ? (
          <p className="mt-3 text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
