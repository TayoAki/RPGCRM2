import type { I18nProvider } from "ra-core";

// Messages that name Atomic CRM itself, said with the host product's name instead.
const BRANDED: Record<string, Record<string, (product: string) => string>> = {
  en: { "crm.dashboard.stepper.install": (product) => `Set up ${product}` },
  fr: { "crm.dashboard.stepper.install": (product) => `Configurer ${product}` },
};

export const brandedI18nProvider = (
  base: I18nProvider,
  product: string,
): I18nProvider => ({
  ...base,
  translate: (key, options) =>
    BRANDED[base.getLocale()]?.[key]?.(product) ?? base.translate(key, options),
});
