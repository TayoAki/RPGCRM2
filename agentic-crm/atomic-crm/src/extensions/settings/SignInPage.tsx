import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanAccess, useNotify } from "ra-core";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { appApi, crmApi, errorMessage } from "../api";
import type { IdentityProvider, SignInSetup } from "../types";
import { CopyField } from "./CopyField";
import { IdentityProviderDialog } from "./IdentityProviderDialog";

const setupKey = ["crm", "sign-in"];
const providersKey = ["crm", "identity-providers"];
const enterpriseKey = ["crm", "enterprise"];

const SingleSignOn = ({ authUrl }: { authUrl: string }) => {
  const { data: providers = [] } = useQuery({
    queryKey: providersKey,
    queryFn: () =>
      appApi<{ providers: IdentityProvider[] }>(
        "/api/admin/identity-providers",
      ).then((body) => body.providers),
  });
  const { data: enterprise } = useQuery({
    queryKey: enterpriseKey,
    queryFn: () =>
      appApi<{ settings: { ssoRequired: boolean } }>("/api/admin/enterprise"),
  });
  const [adding, setAdding] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: providersKey }),
      queryClient.invalidateQueries({ queryKey: enterpriseKey }),
    ]);

  const remove = async (provider: IdentityProvider) => {
    if (
      !window.confirm(
        `Remove ${provider.providerId}? People at ${provider.domain} sign in another way until it's added again.`,
      )
    )
      return;
    try {
      await appApi(
        `/api/admin/identity-providers/${encodeURIComponent(provider.providerId)}`,
        { method: "DELETE" },
      );
      await refresh();
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };
  const requireSso = async (value: boolean) => {
    try {
      await appApi("/api/admin/enterprise/settings/ssoRequired", {
        method: "PUT",
        body: { value },
      });
      await refresh();
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Single sign-on</h2>
            <p className="text-sm text-muted-foreground">
              People sign in with their work account from Okta, Entra ID, Google
              Workspace or any OpenID Connect or SAML provider.
            </p>
          </div>
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add a provider
          </Button>
        </div>
        {providers.length ? (
          <ul className="flex flex-col divide-y">
            {providers.map((provider) => (
              <li
                key={provider.providerId}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {provider.providerId}
                    <Badge variant="secondary">
                      {provider.protocol === "saml" ? "SAML" : "OIDC"}
                    </Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {provider.domain}, {provider.issuer}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${provider.providerId}`}
                  onClick={() => remove(provider)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No provider yet. People sign in with their email and a password.
          </p>
        )}
        <div className="flex items-start justify-between gap-4 border-t pt-3">
          <div>
            <Label htmlFor="sso-required">Require single sign-on</Label>
            <p className="text-sm text-muted-foreground">
              Only your provider lets people in. The first admins can still use
              a password, in case the provider is down.
            </p>
          </div>
          <Switch
            id="sso-required"
            checked={enterprise?.settings.ssoRequired ?? false}
            disabled={!providers.length}
            onCheckedChange={requireSso}
          />
        </div>
      </CardContent>
      {adding ? (
        <IdentityProviderDialog
          authUrl={authUrl}
          onClose={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      ) : null}
    </Card>
  );
};

const DirectorySync = ({ setup }: { setup: SignInSetup }) => {
  const [created, setCreated] = useState<string | null>(null);
  const notify = useNotify();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: setupKey });

  const create = async () => {
    try {
      const { token } = await crmApi<{ token: string }>(
        "/sign-in/scim-tokens",
        { method: "POST" },
      );
      setCreated(token);
      await refresh();
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };
  const revoke = async (id: number) => {
    if (
      !window.confirm(
        "Revoke this token? Your directory stops syncing until it has a new one.",
      )
    )
      return;
    try {
      await crmApi(`/sign-in/scim-tokens/${id}`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Directory sync (SCIM)</h2>
            <p className="text-sm text-muted-foreground">
              Your directory adds people here, keeps their groups up to date,
              and turns off their CRM access and API keys when they leave.
            </p>
          </div>
          <Button variant="outline" onClick={create}>
            <KeyRound className="size-4" />
            Create a token
          </Button>
        </div>
        <CopyField label="SCIM base URL" value={setup.scim_url} />
        {created ? (
          <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            <p>
              Give this token to your directory now. It isn't shown again; if
              it's lost, revoke it and create another.
            </p>
            <CopyField label="Token" value={created} />
          </div>
        ) : null}
        {setup.scim_tokens.length ? (
          <ul className="flex flex-col divide-y">
            {setup.scim_tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div>
                  <code className="text-xs">mgs_{token.prefix}_...</code>
                  <div className="text-xs text-muted-foreground">
                    Made <RelativeDate date={token.created_at} />
                    {token.last_used_at ? (
                      <>
                        , last used <RelativeDate date={token.last_used_at} />
                      </>
                    ) : (
                      ", not used yet"
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revoke(token.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {setup.scim_from_environment
              ? "Your directory uses the token set for this deployment. Tokens made here work too."
              : "No token yet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

/** How people at the customer's company sign in, and how their directory adds and removes them. */
export const SignInPage = () => {
  const { canAccess: isAdmin, isPending } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });
  const { data: setup } = useQuery({
    queryKey: setupKey,
    queryFn: () => crmApi<SignInSetup>("/sign-in/setup"),
    enabled: isAdmin === true,
  });

  if (isPending) return null;
  if (!isAdmin) {
    return (
      <p className="mt-4 text-muted-foreground">
        Only an admin can change how people sign in.
      </p>
    );
  }

  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Sign-in</h1>
        <p className="text-sm text-muted-foreground">
          How people at your company sign in, and how they're added and removed.
        </p>
      </div>
      {setup ? (
        <>
          <SingleSignOn authUrl={setup.auth_url} />
          <DirectorySync setup={setup} />
        </>
      ) : null}
    </div>
  );
};
