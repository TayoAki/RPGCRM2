import { describe, expect, it } from "vitest";

import { i18nProvider } from "../components/atomic-crm/providers/commons/i18nProvider";
import { brandedI18nProvider } from "./brandedI18n";

describe("brandedI18nProvider", () => {
  it("names the host product where Atomic names itself, in English and French", async () => {
    const branded = brandedI18nProvider(i18nProvider, "Acme CRM");

    await branded.changeLocale("en");
    const english = branded.translate("crm.dashboard.stepper.install");
    await branded.changeLocale("fr");
    const french = branded.translate("crm.dashboard.stepper.install");

    expect(english).toBe("Set up Acme CRM");
    expect(french).toBe("Configurer Acme CRM");
  });

  it("says the embed's own buttons in French too", async () => {
    const branded = brandedI18nProvider(i18nProvider, "Acme CRM");
    await branded.changeLocale("fr");

    expect(branded.translate("crm.ask_agent")).toBe("Demander à l'agent");
  });

  it("leaves every other message as Atomic says it", async () => {
    const branded = brandedI18nProvider(i18nProvider, "Acme CRM");
    await branded.changeLocale("en");

    expect(branded.translate("resources.contacts.bulk_tag.action")).toBe("Tag");
  });
});
