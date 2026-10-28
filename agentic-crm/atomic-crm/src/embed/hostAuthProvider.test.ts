import { describe, expect, it } from "vitest";

import { createHostAuthProvider, type HostUser } from "./hostAuthProvider";

const user: HostUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  role: "user",
};

describe("createHostAuthProvider", () => {
  it("identifies the host user as their CRM sale", async () => {
    const authProvider = createHostAuthProvider({ user, saleId: 7 });

    await expect(authProvider.getIdentity?.()).resolves.toEqual({
      id: 7,
      fullName: "Ada Lovelace",
      avatar: undefined,
    });
  });

  it("falls back to the email when the host user has no name", async () => {
    const authProvider = createHostAuthProvider({
      user: { ...user, name: null },
      saleId: 7,
    });

    await expect(authProvider.getIdentity?.()).resolves.toMatchObject({
      fullName: "ada@example.com",
    });
  });

  it("keeps the sales team from a host user who is not an admin", async () => {
    const asUser = createHostAuthProvider({ user, saleId: 7 });
    const asAdmin = createHostAuthProvider({
      user: { ...user, role: "admin" },
      saleId: 7,
    });
    const params = { action: "list", resource: "sales" };

    await expect(asUser.canAccess?.(params)).resolves.toBe(false);
    await expect(asAdmin.canAccess?.(params)).resolves.toBe(true);
  });

  it("signs out of the host and leaves the redirect to it", async () => {
    let signedOut = false;
    const authProvider = createHostAuthProvider({
      user,
      saleId: 7,
      onSignOut: async () => {
        signedOut = true;
      },
    });

    await expect(authProvider.logout({})).resolves.toBe(false);
    expect(signedOut).toBe(true);
  });
});
