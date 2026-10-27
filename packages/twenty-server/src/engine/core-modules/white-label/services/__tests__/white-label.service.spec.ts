import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { WhiteLabelService } from 'src/engine/core-modules/white-label/services/white-label.service';

const buildService = (config: Record<string, string | undefined>) =>
  new WhiteLabelService({
    get: (key: string) => config[key],
  } as unknown as TwentyConfigService);

describe('WhiteLabelService', () => {
  it('derives the logo and source code links from the server URLs when unset', () => {
    const branding = buildService({
      BRAND_NAME: 'Acme CRM',
      SERVER_URL: 'https://api.acme.test',
      FRONTEND_URL: 'https://app.acme.test',
      BRAND_WEBSITE_URL: '',
    }).getBranding();

    expect(branding).toEqual({
      name: 'Acme CRM',
      logoUrl:
        'https://app.acme.test/images/icons/android/android-launchericon-192-192.png',
      websiteUrl: null,
      supportUrl: null,
      documentationUrl: null,
      termsOfServiceUrl: null,
      privacyPolicyUrl: null,
      legalEntity: null,
      sourceCodeUrl: 'https://api.acme.test/source-code',
    });
  });

  it('uses the configured links when set', () => {
    const branding = buildService({
      BRAND_NAME: 'Acme CRM',
      SERVER_URL: 'https://api.acme.test',
      BRAND_LOGO_URL: 'https://cdn.acme.test/logo.png',
      BRAND_SUPPORT_URL: 'mailto:help@acme.test',
      BRAND_LEGAL_ENTITY: 'Acme Inc., Austin, TX',
      SOURCE_CODE_URL: 'https://github.com/acme/crm',
    }).getBranding();

    expect(branding).toMatchObject({
      logoUrl: 'https://cdn.acme.test/logo.png',
      supportUrl: 'mailto:help@acme.test',
      legalEntity: 'Acme Inc., Austin, TX',
      sourceCodeUrl: 'https://github.com/acme/crm',
    });
  });
});
