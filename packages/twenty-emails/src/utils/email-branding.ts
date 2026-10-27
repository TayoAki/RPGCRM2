import { DEFAULT_BRANDING } from 'twenty-shared/constants';
import { type Branding } from 'twenty-shared/types';

let emailBranding: Branding = DEFAULT_BRANDING;

// Set once by the server at boot; emails render synchronously and cannot await config.
export const setEmailBranding = (branding: Branding) => {
  emailBranding = branding;
};

export const getEmailBranding = (): Branding => emailBranding;
