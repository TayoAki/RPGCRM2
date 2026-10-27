import { validate } from 'src/engine/core-modules/twenty-config/config-variables';

describe('brand config variables', () => {
  it('accepts unset brand links passed as empty strings', () => {
    expect(() =>
      validate({
        BRAND_NAME: 'Acme CRM',
        BRAND_LOGO_URL: '',
        BRAND_WEBSITE_URL: '',
        BRAND_SUPPORT_URL: '',
        BRAND_DOCUMENTATION_URL: '',
        BRAND_TERMS_OF_SERVICE_URL: '',
        BRAND_PRIVACY_POLICY_URL: '',
        BRAND_LEGAL_ENTITY: '',
        SOURCE_CODE_URL: '',
      }),
    ).not.toThrow();
  });

  it('rejects a brand link that is not an absolute URL', () => {
    expect(() => validate({ BRAND_WEBSITE_URL: 'acme.test' })).toThrow();
  });
});
