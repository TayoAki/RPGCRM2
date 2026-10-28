// Resolved by vite-crm.ts to agentic-crm/atomic-crm/src/embed/CrmEmbed.tsx, which Atomic's own
// tsconfig checks. Declared here so this app's compiler never walks into Atomic's sources.
declare module "atomic-crm/embed" {
  import type { RouterHistory } from "@tanstack/react-router";
  import type { ComponentType } from "react";
  import type { AuthenticatedUser } from "@/lib/auth/queries";

  export type CrmEmbedProps = {
    basename: string;
    history: RouterHistory;
    user: Pick<AuthenticatedUser, "id" | "email" | "name" | "image" | "role">;
    theme: "light" | "dark";
    onSignOut?: () => Promise<void>;
  };

  export const CrmEmbed: ComponentType<CrmEmbedProps>;
}
