import { Navigate } from "react-router";

/*
 * What the embedded CRM runs instead of some Atomic modules: its Supabase sign-in, data and pages
 * and its theme switch, which the host provides, and its release notes, which aren't the product's.
 * The host's build swaps the modules (see vite-crm.ts in OpenDuet's app), which also keeps them out
 * of the bundle.
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
export const ChangelogPage = backToStart("/changelog");

export const ThemeModeToggle = () => null;
