import type { AuthProvider } from "ra-core";

import { canAccess } from "../components/atomic-crm/providers/commons/canAccess";
import type { CurrentSale } from "./hostDataProvider";

export type HostUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: "admin" | "user";
};

export type HostAuthProviderOptions = {
  user: HostUser;
  currentSale: () => Promise<CurrentSale>;
  onSignOut?: () => Promise<void>;
};

// The host has already signed the person in, so the CRM never shows its own login.
export const createHostAuthProvider = ({
  user,
  currentSale,
  onSignOut,
}: HostAuthProviderOptions): AuthProvider => ({
  login: async () => undefined,
  logout: async () => {
    await onSignOut?.();
    return false;
  },
  checkAuth: async () => undefined,
  checkError: async () => undefined,
  // The CRM's own profile, which a person can rename, and the host's picture when it has none.
  getIdentity: async () => {
    const sale = await currentSale();
    return {
      id: sale.id,
      fullName:
        `${sale.first_name} ${sale.last_name}`.trim() ||
        user.name ||
        user.email,
      avatar: sale.avatar?.src ?? user.image ?? undefined,
    };
  },
  canAccess: async ({ signal: _signal, ...params }) =>
    canAccess(user.role, params),
});
