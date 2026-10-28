import { AsyncLocalStorage } from "node:async_hooks";
import { checkNavigationTarget } from "../computer/target";
import type { Database } from "../db/client";
import { ssoProviders } from "../db/schema";

const REGISTERING = /\/sso\/(register|update-provider)$/;

function publicHttpsOrigin(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const verdict = checkNavigationTarget(raw);
  if (!verdict.allowed) return undefined;
  const url = new URL(verdict.url);
  return url.protocol === "https:" ? url.origin : undefined;
}

const registering = new AsyncLocalStorage<string[]>();

/**
 * Runs Better Auth's handler knowing which issuer an admin is registering. Its trusted-origin check
 * runs after the body is read, so the body is read here first.
 */
export async function withProviderBeingRegistered<TResult>(
  request: Request,
  handle: () => Promise<TResult>,
): Promise<TResult> {
  if (
    request.method !== "POST" ||
    !REGISTERING.test(new URL(request.url).pathname)
  ) {
    return handle();
  }
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as {
    issuer?: unknown;
    oidcConfig?: { discoveryEndpoint?: unknown };
  } | null;
  const origins = [body?.issuer, body?.oidcConfig?.discoveryEndpoint]
    .map(publicHttpsOrigin)
    .filter((origin): origin is string => Boolean(origin));
  return registering.run(origins, handle);
}

/**
 * Better Auth only fetches an OIDC discovery document from a trusted origin. Admins add Okta or Entra
 * from the CRM's settings and can't edit TRUSTED_ORIGINS, so a registered provider's issuer is trusted,
 * as is a public https issuer while an admin registers it (the register route is admin-only, see
 * app.ts).
 */
export function trustedOriginsWithProviders(
  database: Database,
  fixed: readonly string[],
) {
  return async (): Promise<string[]> => {
    const registered = await database
      .select({ issuer: ssoProviders.issuer })
      .from(ssoProviders)
      .catch(() => []);
    return [
      ...fixed,
      ...registered
        .map(({ issuer }) => publicHttpsOrigin(issuer))
        .filter((origin): origin is string => Boolean(origin)),
      ...(registering.getStore() ?? []),
    ];
  };
}
