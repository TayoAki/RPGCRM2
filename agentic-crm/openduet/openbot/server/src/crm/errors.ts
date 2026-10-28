import type { Context } from "hono";
import { ZodError } from "zod";
import { CrmQueryError } from "./filters";
import { CrmRefusal } from "./refusal";

/** The answer to a CRM request that failed: refusals and bad input as messages, anything else rethrown. */
export function crmErrorResponse(error: Error, context: Context) {
  if (error instanceof CrmRefusal) {
    return context.json({ error: error.message }, error.status);
  }
  if (error instanceof CrmQueryError) {
    return context.json({ error: error.message }, 400);
  }
  if (error instanceof ZodError) {
    const [issue] = error.issues;
    const field = issue?.path.join(".");
    return context.json(
      {
        error: issue
          ? `${field ? `${field}: ` : ""}${issue.message}`
          : "Check the form.",
      },
      400,
    );
  }
  const cause = (error as { cause?: Record<string, unknown> }).cause;
  const postgresCode = String(cause?.errno ?? cause?.code ?? "");
  if (postgresCode.startsWith("22") || postgresCode.startsWith("23")) {
    console.error(
      JSON.stringify({
        type: "crm-write-refused",
        path: context.req.path,
        code: postgresCode,
        detail: String(cause?.message ?? ""),
      }),
    );
  }
  if (postgresCode === "23503") {
    return context.json(
      { error: "It's linked to other records, so it can't change." },
      409,
    );
  }
  if (postgresCode.startsWith("22") || postgresCode.startsWith("23")) {
    return context.json(
      { error: "Some of those values don't fit. Check the form." },
      400,
    );
  }
  throw error;
}
