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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { appApi, errorMessage } from "../api";
import { CopyField } from "./CopyField";

type Protocol = "oidc" | "saml";

const SHORT_NAME = /^[a-z0-9][a-z0-9-]{1,39}$/;

const EMPTY = {
  providerId: "",
  domain: "",
  issuer: "",
  clientId: "",
  clientSecret: "",
  entryPoint: "",
  metadata: "",
  cert: "",
};

function registerBody(protocol: Protocol, draft: typeof EMPTY) {
  const common = {
    providerId: draft.providerId,
    issuer: draft.issuer.trim(),
    domain: draft.domain.trim().toLowerCase(),
  };
  if (protocol === "oidc") {
    return {
      ...common,
      oidcConfig: {
        clientId: draft.clientId.trim(),
        clientSecret: draft.clientSecret.trim(),
        discoveryEndpoint: `${common.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
      },
    };
  }
  return {
    ...common,
    samlConfig: {
      entryPoint: draft.entryPoint.trim(),
      ...(draft.metadata.trim()
        ? { idpMetadata: { metadata: draft.metadata.trim() } }
        : {
            cert: draft.cert.trim(),
            idpMetadata: { entityID: common.issuer },
          }),
    },
  };
}

type IdentityProviderDialogProps = {
  authUrl: string;
  onClose: () => void;
  onAdded: () => void;
};

/** Connects the company's identity provider (Okta, Entra ID, Google Workspace) over OIDC or SAML. */
export const IdentityProviderDialog = ({
  authUrl,
  onClose,
  onAdded,
}: IdentityProviderDialogProps) => {
  const [protocol, setProtocol] = useState<Protocol>("oidc");
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();
  const set =
    (field: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
      setDraft({ ...draft, [field]: event.target.value });
  const name = draft.providerId || "<short name>";
  const ready =
    SHORT_NAME.test(draft.providerId) &&
    draft.domain.includes(".") &&
    draft.issuer.trim() &&
    (protocol === "oidc"
      ? draft.clientId.trim() && draft.clientSecret.trim()
      : draft.entryPoint.trim() &&
        (draft.metadata.trim() || draft.cert.trim()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await appApi("/api/auth/sso/register", {
        method: "POST",
        body: registerBody(protocol, draft),
      });
      notify(
        `People at ${draft.domain} can now sign in with ${draft.providerId}.`,
      );
      onAdded();
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add an identity provider</DialogTitle>
            <DialogDescription>
              People whose email is on this domain sign in through it.
            </DialogDescription>
          </DialogHeader>
          <ToggleGroup
            type="single"
            variant="outline"
            value={protocol}
            onValueChange={(value) => value && setProtocol(value as Protocol)}
            className="self-start"
          >
            <ToggleGroupItem value="oidc">OpenID Connect</ToggleGroupItem>
            <ToggleGroupItem value="saml">SAML</ToggleGroupItem>
          </ToggleGroup>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sso-name">Short name</Label>
              <Input
                id="sso-name"
                placeholder="okta"
                value={draft.providerId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    providerId: event.target.value.toLowerCase(),
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sso-domain">Email domain</Label>
              <Input
                id="sso-domain"
                placeholder="acme.com"
                value={draft.domain}
                onChange={set("domain")}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">In your identity provider, set</p>
            {protocol === "oidc" ? (
              <CopyField
                label="Redirect URI"
                value={`${authUrl}/sso/callback/${name}`}
              />
            ) : (
              <>
                <CopyField
                  label="ACS URL"
                  value={`${authUrl}/sso/saml2/sp/acs/${name}`}
                />
                <CopyField
                  label="Entity ID and metadata"
                  value={`${authUrl}/sso/saml2/sp/metadata?providerId=${name}`}
                />
              </>
            )}
          </div>
          {protocol === "oidc" ? (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sso-issuer">Issuer URL</Label>
                <Input
                  id="sso-issuer"
                  placeholder="https://acme.okta.com"
                  value={draft.issuer}
                  onChange={set("issuer")}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sso-client">Client ID</Label>
                  <Input
                    id="sso-client"
                    value={draft.clientId}
                    onChange={set("clientId")}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sso-secret">Client secret</Label>
                  <Input
                    id="sso-secret"
                    type="password"
                    value={draft.clientSecret}
                    onChange={set("clientSecret")}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sso-issuer">
                    Identity provider entity ID
                  </Label>
                  <Input
                    id="sso-issuer"
                    placeholder="http://www.okta.com/exk..."
                    value={draft.issuer}
                    onChange={set("issuer")}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sso-entry">Sign-in URL</Label>
                  <Input
                    id="sso-entry"
                    placeholder="https://acme.okta.com/app/.../sso/saml"
                    value={draft.entryPoint}
                    onChange={set("entryPoint")}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sso-metadata">Metadata XML</Label>
                <Textarea
                  id="sso-metadata"
                  rows={4}
                  placeholder="Paste the metadata your identity provider gives you"
                  value={draft.metadata}
                  onChange={set("metadata")}
                />
              </div>
              {draft.metadata.trim() ? null : (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sso-cert">Or its signing certificate</Label>
                  <Textarea
                    id="sso-cert"
                    rows={3}
                    placeholder="-----BEGIN CERTIFICATE-----"
                    value={draft.cert}
                    onChange={set("cert")}
                  />
                </div>
              )}
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || saving}>
              {saving ? "Connecting..." : "Add provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
