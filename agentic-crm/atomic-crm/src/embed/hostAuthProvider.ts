import type { AuthProvider } from "ra-core";

import { canAccess } from "../components/atomic-crm/providers/commons/canAccess";

export type HostUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: "admin" | "user";
};

export type HostAuthProviderOptions = {
  user: HostUser;
  saleId: number;
  onSignOut?: () => Promise<void>;
};

// The host has already signed the person in, so the CRM never shows its own login.
export const createHostAuthProvider = ({
  user,
  saleId,
  onSignOut,
}: HostAuthProviderOptions): AuthProvider => ({
  login: async () => undefined,
  logout: async () => {
    await onSignOut?.();
    return false;
  },
  checkAuth: async () => undefined,
  checkError: async () => undefined,
  getIdentity: async () => ({
    id: saleId,
    fullName: user.name || user.email,
    avatar: user.image ?? undefined,
  }),
  canAccess: async ({ signal: _signal, ...params }) =>
    canAccess(user.role, params),
});
