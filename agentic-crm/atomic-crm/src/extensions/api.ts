import { HttpError } from "ra-core";

import { CRM_API } from "../embed/hostDataProvider";

/** The CRM API's own endpoints beyond records: mail, automations and proposal actions. */
export async function crmApi<TResult = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<TResult> {
  const response = await fetch(`${CRM_API}${path}`, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(
      body.error ?? response.statusText,
      response.status,
      body,
    );
  }
  return (body.data ?? body) as TResult;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";
