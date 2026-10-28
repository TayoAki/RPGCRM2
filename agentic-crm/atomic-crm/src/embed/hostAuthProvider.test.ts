import { describe, expect, it } from "vitest";

import { createHostAuthProvider, type HostUser } from "./hostAuthProvider";
import type { CurrentSale } from "./hostDataProvider";

const user: HostUser = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  image: "https://example.com/ada.png",
  role: "user",
};

const sale =
  (overrides: Partial<CurrentSale> = {}) =>
  async () => ({
    id: 7,
    first_name: "Ada",
    last_name: "King",
    ...overrides,
  });

describe("createHostAuthProvider", () => {
  it("identifies the person as their CRM user, by the name they chose in the CRM", async () => {
    const authProvider = createHostAuthProvider({ user, currentSale: sale() });

    await expect(authProvider.getIdentity?.()).resolves.toEqual({
      id: 7,
      fullName: "Ada King",
      avatar: "https://example.com/ada.png",
    });
  });

  it("prefers the picture set in the CRM over the host's", async () => {
    const authProvider = createHostAuthProvider({
      user,
      currentSale: sale({ avatar: { src: "data:image/png;base64,AAAA" } }),
    });

    await expect(authProvider.getIdentity?.()).resolves.toMatchObject({
      avatar: "data:image/png;base64,AAAA",
    });
  });

  it("falls back to the host's name when the CRM user has none", async () => {
    const authProvider = createHostAuthProvider({
      user: { ...user, name: null },
      currentSale: sale({ first_name: "", last_name: "" }),
    });

    await expect(authProvider.getIdentity?.()).resolves.toMatchObject({
      fullName: "ada@example.com",
    });
  });

  it("keeps the sales team from a host user who is not an admin", async () => {
    const asUser = createHostAuthProvider({ user, currentSale: sale() });
    const asAdmin = createHostAuthProvider({
      user: { ...user, role: "admin" },
      currentSale: sale(),
    });
    const params = { action: "list", resource: "sales" };

    await expect(asUser.canAccess?.(params)).resolves.toBe(false);
    await expect(asAdmin.canAccess?.(params)).resolves.toBe(true);
  });

  it("signs out of the host and leaves the redirect to it", async () => {
    let signedOut = false;
    const authProvider = createHostAuthProvider({
      user,
      currentSale: sale(),
      onSignOut: async () => {
        signedOut = true;
      },
    });

    await expect(authProvider.logout({})).resolves.toBe(false);
    expect(signedOut).toBe(true);
  });
});
