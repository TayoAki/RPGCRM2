import type { I18nProvider } from "ra-core";

// The embed's own messages, and Atomic's that name Atomic CRM itself, said with the host product's name.
const BRANDED: Record<string, Record<string, (product: string) => string>> = {
  en: {
    "crm.dashboard.stepper.install": (product) => `Set up ${product}`,
    "crm.ask_agent": () => "Ask the agent",
  },
  fr: {
    "crm.dashboard.stepper.install": (product) => `Configurer ${product}`,
    "crm.ask_agent": () => "Demander à l'agent",
  },
};

export const brandedI18nProvider = (
  base: I18nProvider,
  product: string,
): I18nProvider => ({
  ...base,
  translate: (key, options) =>
    BRANDED[base.getLocale()]?.[key]?.(product) ?? base.translate(key, options),
});
