import { isObject } from '@sniptt/guards';
import {
  BRANDING_BOOTSTRAP_ELEMENT_ID,
  DEFAULT_BRANDING,
} from 'twenty-shared/constants';
import { type Branding } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

export const readBrandingFromDocument = (): Branding => {
  const element = document.getElementById(BRANDING_BOOTSTRAP_ELEMENT_ID);

  if (!isDefined(element)) {
    return DEFAULT_BRANDING;
  }

  try {
    const branding: unknown = JSON.parse(element.textContent ?? 'null');

    if (isObject(branding)) {
      return { ...DEFAULT_BRANDING, ...(branding as Partial<Branding>) };
    }
  } catch {}

  return DEFAULT_BRANDING;
};
