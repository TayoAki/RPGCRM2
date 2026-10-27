// Every null link hides the UI that would point to it.
export type Branding = {
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportUrl: string | null;
  documentationUrl: string | null;
  termsOfServiceUrl: string | null;
  privacyPolicyUrl: string | null;
  legalEntity: string | null;
  sourceCodeUrl: string;
};
