import { z } from "zod";

const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "docs",
  "help",
  "login",
  "magpie",
  "mail",
  "signup",
  "status",
  "support",
  "www",
]);

export const slugRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/,
    "Use 3 to 30 lowercase letters, digits and dashes, starting with a letter.",
  )
  .refine((slug) => !RESERVED.has(slug), "That address is taken.");

export const signupInput = z.object({
  company: z.string().trim().min(1, "Add your company's name.").max(80),
  name: z.string().trim().min(1, "Add your name.").max(80),
  email: z.string().trim().toLowerCase().email("That email doesn't look right."),
  slug: slugRule,
});

export type SignupInput = z.infer<typeof signupInput>;

/** A workspace address from a company name: "Acme Corp." becomes "acme-corp". */
export function slugFrom(company: string): string {
  return company
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 30)
    .replace(/-+$/, "");
}
