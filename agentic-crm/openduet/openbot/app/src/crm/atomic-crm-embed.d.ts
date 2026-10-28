// Resolved by vite-crm.ts to agentic-crm/atomic-crm/src/embed/CrmEmbed.tsx, which Atomic's own
// tsconfig checks. Declared here so this app's compiler never walks into Atomic's sources.
declare module "atomic-crm/embed" {
  import type { RouterHistory } from "@tanstack/react-router";
  import type { ComponentType } from "react";
  import type { AuthenticatedUser } from "@/lib/auth/queries";

  export type CrmRecordRef = {
    resource: "contacts" | "companies" | "deals";
    id: number;
    title: string;
  };

  export type CrmEmbedProps = {
    basename: string;
    history: RouterHistory;
    user: Pick<AuthenticatedUser, "id" | "email" | "name" | "image" | "role">;
    theme: "light" | "dark";
    onSignOut?: () => Promise<void>;
    onAskAgent?: (record: CrmRecordRef) => void;
    brand?: { title: string; lightModeLogo: string; darkModeLogo: string };
  };

  export const CrmEmbed: ComponentType<CrmEmbedProps>;
}

// A client's proposal link (agentic-crm/atomic-crm/src/embed/ProposalPage.tsx), without the CRM.
declare module "atomic-crm/proposal" {
  import type { ComponentType } from "react";

  export const ProposalPage: ComponentType<{ token: string }>;
}
