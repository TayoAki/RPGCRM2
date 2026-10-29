import { localStorageStore } from "ra-core";
import { useLayoutEffect, useMemo, useState } from "react";
import { unstable_HistoryRouter as HistoryRouter } from "react-router";

import { i18nProvider } from "../components/atomic-crm/providers/commons/i18nProvider";
import { CRM } from "../components/atomic-crm/root/CRM";
import { brandedI18nProvider } from "./brandedI18n";
import { type CrmRecordRef, HostContext } from "./host";
import { createHostAuthProvider, type HostUser } from "./hostAuthProvider";
import { createHostDataProvider, fetchCurrentSale } from "./hostDataProvider";
import { createHostRouterHistory, type HostHistory } from "./hostHistory";
import "./embed.css";

export type { CrmRecordRef, HostHistory, HostUser };

export type CrmEmbedProps = {
  basename: string;
  history: HostHistory;
  user: HostUser;
  theme: "light" | "dark";
  // Keep it stable: a new function rebuilds the auth provider.
  onSignOut?: () => Promise<void>;
  // Shows "Ask the agent" on contacts, companies and deals.
  onAskAgent?: (record: CrmRecordRef) => void;
  // The host's product, until an admin sets the CRM's own in its settings.
  brand?: { title: string; lightModeLogo: string; darkModeLogo: string };
  hostFrame?: boolean;
};

const THEME_STORE_KEY = "theme";

export const CrmEmbed = ({
  basename,
  history,
  user,
  theme,
  onSignOut,
  onAskAgent,
  brand,
  hostFrame = false,
}: CrmEmbedProps) => {
  const routerHistory = useMemo(
    () => createHostRouterHistory(history),
    [history],
  );
  const dataProvider = useMemo(() => createHostDataProvider(), []);
  const authProvider = useMemo(
    () =>
      createHostAuthProvider({
        user,
        currentSale: () => fetchCurrentSale(),
        onSignOut,
      }),
    [user, onSignOut],
  );
  const host = useMemo(
    () => ({ onAskAgent, hostFrame }),
    [onAskAgent, hostFrame],
  );
  const product = brand?.title;
  const brandedI18n = useMemo(
    () => (product ? brandedI18nProvider(i18nProvider, product) : undefined),
    [product],
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
      <HostContext.Provider value={host}>
        <CRM
          dataProvider={dataProvider}
          authProvider={authProvider}
          store={store}
          disableTelemetry
          {...brand}
          {...(brandedI18n ? { i18nProvider: brandedI18n } : {})}
        />
      </HostContext.Provider>
    </HistoryRouter>
  );
};
