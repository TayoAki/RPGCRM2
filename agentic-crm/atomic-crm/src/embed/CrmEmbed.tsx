import { localStorageStore } from "ra-core";
import { useLayoutEffect, useMemo, useState } from "react";
import { unstable_HistoryRouter as HistoryRouter } from "react-router";

import { createDataProvider } from "../components/atomic-crm/providers/fakerest/dataProvider";
import generateData from "../components/atomic-crm/providers/fakerest/dataGenerator";
import { CRM } from "../components/atomic-crm/root/CRM";
import { createHostAuthProvider, type HostUser } from "./hostAuthProvider";
import { createHostRouterHistory, type HostHistory } from "./hostHistory";
import { withHostSale } from "./hostSale";
import "./embed.css";

export type { HostHistory, HostUser };

export type CrmEmbedProps = {
  basename: string;
  history: HostHistory;
  user: HostUser;
  theme: "light" | "dark";
  // Keep it stable: a new function rebuilds the providers and resets the fake data.
  onSignOut?: () => Promise<void>;
};

const HOST_SALE_ID = 0;
const THEME_STORE_KEY = "theme";

export const CrmEmbed = ({
  basename,
  history,
  user,
  theme,
  onSignOut,
}: CrmEmbedProps) => {
  const routerHistory = useMemo(
    () => createHostRouterHistory(history),
    [history],
  );
  const authProvider = useMemo(
    () => createHostAuthProvider({ user, saleId: HOST_SALE_ID, onSignOut }),
    [user, onSignOut],
  );
  const dataProvider = useMemo(
    () =>
      createDataProvider({
        db: withHostSale(generateData(), user, HOST_SALE_ID),
        authProvider,
      }),
    [user, authProvider],
  );
  // The host owns the theme; seeding the store before the first render avoids a flash.
  const [store] = useState(() => {
    const crmStore = localStorageStore(undefined, "CRM");
    crmStore.setItem(THEME_STORE_KEY, theme);
    return crmStore;
  });
  useLayoutEffect(() => {
    store.setItem(THEME_STORE_KEY, theme);
  }, [store, theme]);

  return (
    <HistoryRouter basename={basename} history={routerHistory}>
      <CRM
        dataProvider={dataProvider}
        authProvider={authProvider}
        store={store}
        disableTelemetry
      />
    </HistoryRouter>
  );
};
