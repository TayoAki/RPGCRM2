import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { Copy, KeyRound } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { RelativeDate } from "../../components/atomic-crm/misc/RelativeDate";
import { crmApi, errorMessage } from "../api";
import type { ApiKey } from "../types";

const keysKey = ["crm", "api-keys"];

/** Keys other software uses to reach the CRM. A key does what its owner's role allows. */
export const ApiKeysPage = () => {
  const { data: keys = [] } = useQuery({
    queryKey: keysKey,
    queryFn: () => crmApi<ApiKey[]>("/api-keys"),
  });
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const notify = useNotify();
  const queryClient = useQueryClient();
  const base = `${window.location.origin}/api/v1`;

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { key } = await crmApi<{ key: string }>("/api-keys", {
        method: "POST",
        body: { name },
      });
      setCreated(key);
      setName("");
      await queryClient.invalidateQueries({ queryKey: keysKey });
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };
  const revoke = async (key: ApiKey) => {
    if (
      !window.confirm(`Revoke "${key.name}"? Software using it stops working.`)
    )
      return;
    try {
      await crmApi(`/api-keys/${key.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: keysKey });
    } catch (error) {
      notify(errorMessage(error), { type: "error" });
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Copied.");
    } catch {
      notify("Couldn't copy. Select the key and copy it.", { type: "warning" });
    }
  };

  return (
    <div className="mx-auto mt-4 flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Other software reads and changes the CRM's records with a key. A key
          acts as you: it can do what your role allows, and nothing else.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <form onSubmit={create} className="flex flex-wrap gap-2">
            <Input
              aria-label="Key name"
              placeholder="What will use it, such as Zapier"
              className="max-w-xs"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" disabled={!name.trim()}>
              <KeyRound className="size-4" />
              Create a key
            </Button>
          </form>
          {created ? (
            <div className="flex flex-col gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
              <p>
                Copy this key now. It isn't shown again; if it's lost, revoke it
                and create another.
              </p>
              <div className="flex items-center gap-2">
                <code className="break-all rounded bg-background px-2 py-1">
                  {created}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy the key"
                  onClick={() => copy(created)}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
          {keys.length ? (
            <ul className="flex flex-col divide-y">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {key.name}{" "}
                      <code className="text-xs text-muted-foreground">
                        mgp_{key.prefix}_...
                      </code>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {key.owner_first_name} {key.owner_last_name}, made{" "}
                      <RelativeDate date={key.created_at} />
                      {key.last_used_at ? (
                        <>
                          , last used <RelativeDate date={key.last_used_at} />
                        </>
                      ) : (
                        ", never used"
                      )}
                    </div>
                  </div>
                  {key.revoked_at ? (
                    <span className="text-xs text-muted-foreground">
                      Revoked
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revoke(key)}
                    >
                      Revoke
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2 text-sm">
          <h2 className="font-semibold">Using the API</h2>
          <p className="text-muted-foreground">
            Send the key in the Authorization header. Every object, including
            the ones you add, is at {base}/&lt;object&gt;; the full description
            is at {base}/openapi.json.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {`curl ${base}/contacts?per_page=10 \\\n  -H "Authorization: Bearer <your key>"`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};
