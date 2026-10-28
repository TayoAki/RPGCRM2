import { Navigate } from "react-router";

/*
 * What the embedded CRM runs instead of Atomic's Supabase sign-in, data and pages, and its theme
 * switch: the host provides all of them. The host's build swaps the modules (see vite-crm.ts in
 * OpenDuet's app), which keeps Supabase's client out of the bundle.
 */
const providedByHost = (): never => {
  throw new Error("The embedded CRM uses the host's sign-in and data.");
};

export const getAuthProvider = providedByHost;
export const getDataProvider = providedByHost;

const backToStart = (path: string) =>
  Object.assign(() => <Navigate to="/" replace />, { path });

export const SetPasswordPage = backToStart("set-password");
export const ForgotPasswordPage = backToStart("forgot-password");
export const OAuthConsentPage = backToStart("/oauth/consent");

export const ThemeModeToggle = () => null;
