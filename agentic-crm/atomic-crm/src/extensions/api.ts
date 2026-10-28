import { HttpError } from "ra-core";

import { CRM_API } from "../embed/hostDataProvider";

type RequestInit = { method?: string; body?: unknown };

/** The CRM API's own endpoints beyond records: mail, automations and proposal actions. */
export const crmApi = <TResult = unknown>(path: string, init?: RequestInit) =>
  appApi<TResult>(`${CRM_API}${path}`, init);

/** Any of the app's own endpoints, such as OpenDuet's /api/admin and /api/auth. */
export async function appApi<TResult = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<TResult> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok || body === undefined) {
    throw new HttpError(
      body?.error ??
        body?.message ??
        (response.statusText || "The CRM didn't answer."),
      response.status,
      body ?? {},
    );
  }
  return (body.data ?? body) as TResult;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";
