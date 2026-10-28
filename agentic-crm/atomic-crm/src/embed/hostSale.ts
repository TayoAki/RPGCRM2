import type { Db } from "../components/atomic-crm/providers/fakerest/dataGenerator/types";
import type { RAFile } from "../components/atomic-crm/types";
import type { HostUser } from "./hostAuthProvider";

// Sales are the CRM's users: the signed-in host user takes over one, matched by user_id.
export const withHostSale = (db: Db, user: HostUser, saleId: number): Db => {
  const [firstName, ...otherNames] = (user.name?.trim() || user.email)
    .split(/\s+/)
    .filter(Boolean);
  return {
    ...db,
    sales: db.sales.map((sale) =>
      sale.id === saleId
        ? {
            ...sale,
            user_id: user.id,
            first_name: firstName ?? user.email,
            last_name: otherNames.join(" "),
            email: user.email,
            administrator: user.role === "admin",
            avatar: user.image
              ? ({ src: user.image, title: user.email } as RAFile)
              : undefined,
          }
        : sale,
    ),
  };
};
