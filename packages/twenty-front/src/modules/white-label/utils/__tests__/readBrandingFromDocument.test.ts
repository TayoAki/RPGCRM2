import {
  BRANDING_BOOTSTRAP_ELEMENT_ID,
  DEFAULT_BRANDING,
} from 'twenty-shared/constants';

import { readBrandingFromDocument } from '@/white-label/utils/readBrandingFromDocument';

const renderBootstrapElement = (content: string) => {
  const element = document.createElement('script');

  element.id = BRANDING_BOOTSTRAP_ELEMENT_ID;
  element.type = 'application/json';
  element.textContent = content;
  document.head.appendChild(element);
};

describe('readBrandingFromDocument', () => {
  afterEach(() => {
    document.getElementById(BRANDING_BOOTSTRAP_ELEMENT_ID)?.remove();
  });

  it('falls back to the default branding without a bootstrap element', () => {
    expect(readBrandingFromDocument()).toEqual(DEFAULT_BRANDING);
  });

  it('merges the server branding over the defaults', () => {
    renderBootstrapElement(
      JSON.stringify({ name: 'Acme CRM', supportUrl: 'mailto:help@acme.test' }),
    );

    expect(readBrandingFromDocument()).toEqual({
      ...DEFAULT_BRANDING,
      name: 'Acme CRM',
      supportUrl: 'mailto:help@acme.test',
    });
  });

  it('falls back to the default branding on malformed JSON', () => {
    renderBootstrapElement('{not json');

    expect(readBrandingFromDocument()).toEqual(DEFAULT_BRANDING);
  });
});
