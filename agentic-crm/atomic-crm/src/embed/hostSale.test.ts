import { describe, expect, it } from "vitest";

import type { Db } from "../components/atomic-crm/providers/fakerest/dataGenerator/types";
import type { Sale } from "../components/atomic-crm/types";
import { withHostSale } from "./hostSale";

const sale = (id: number, first_name: string): Sale & { id: number } => ({
  id,
  user_id: String(id),
  first_name,
  last_name: "Doe",
  email: `${first_name.toLowerCase()}@atomic.dev`,
  administrator: false,
});

const db = { sales: [sale(0, "Jane"), sale(1, "John")] } as unknown as Db;

describe("withHostSale", () => {
  it("lets the host user take over the given sale", () => {
    const result = withHostSale(
      db,
      {
        id: "user-1",
        email: "ada@example.com",
        name: "Ada King Lovelace",
        role: "admin",
      },
      0,
    );

    expect(result.sales[0]).toMatchObject({
      id: 0,
      user_id: "user-1",
      first_name: "Ada",
      last_name: "King Lovelace",
      email: "ada@example.com",
      administrator: true,
    });
    expect(result.sales[1]).toEqual(db.sales[1]);
  });

  it("names the sale after the email when the host user has no name", () => {
    const result = withHostSale(
      db,
      { id: "user-1", email: "ada@example.com", name: null, role: "user" },
      0,
    );

    expect(result.sales[0]).toMatchObject({
      first_name: "ada@example.com",
      last_name: "",
      administrator: false,
    });
  });
});
