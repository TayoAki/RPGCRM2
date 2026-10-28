import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import * as themeModeToggle from "../components/admin/theme-mode-toggle";
import * as supabaseProviders from "../components/atomic-crm/providers/supabase";
import * as forgotPasswordPage from "../components/supabase/forgot-password-page";
import * as oauthConsentPage from "../components/supabase/oauth-consent-page";
import * as setPasswordPage from "../components/supabase/set-password-page";
import * as standIns from "./standIns";

const replaced = {
  themeModeToggle,
  supabaseProviders,
  forgotPasswordPage,
  oauthConsentPage,
  setPasswordPage,
};

describe("standIns", () => {
  it.each(Object.entries(replaced))(
    "exports everything the %s module it replaces exports",
    (_name, module) => {
      for (const name of Object.keys(module)) {
        expect(standIns).toHaveProperty(name);
      }
    },
  );

  it("answers on the routes of the Supabase pages it replaces", () => {
    expect(standIns.SetPasswordPage.path).toBe(
      setPasswordPage.SetPasswordPage.path,
    );
    expect(standIns.ForgotPasswordPage.path).toBe(
      forgotPasswordPage.ForgotPasswordPage.path,
    );
    expect(standIns.OAuthConsentPage.path).toBe(
      oauthConsentPage.OAuthConsentPage.path,
    );
  });

  it("sends a visit to a Supabase page back to the CRM's start", async () => {
    const screen = await render(
      <MemoryRouter initialEntries={["/set-password"]}>
        <Routes>
          <Route path="/" element={<p>Dashboard</p>} />
          <Route
            path={standIns.SetPasswordPage.path}
            element={<standIns.SetPasswordPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await expect.element(screen.getByText("Dashboard")).toBeVisible();
  });
});
