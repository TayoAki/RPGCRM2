import { Injectable, type OnModuleInit } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Branding } from 'twenty-shared/types';
import { setEmailBranding } from 'twenty-emails';

import { type ConfigVariables } from 'src/engine/core-modules/twenty-config/config-variables';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

const BUNDLED_LOGO_PATH =
  '/images/icons/android/android-launchericon-192-192.png';

type OptionalBrandingConfigKey = keyof Pick<
  ConfigVariables,
  | 'BRAND_LOGO_URL'
  | 'BRAND_WEBSITE_URL'
  | 'BRAND_SUPPORT_URL'
  | 'BRAND_DOCUMENTATION_URL'
  | 'BRAND_TERMS_OF_SERVICE_URL'
  | 'BRAND_PRIVACY_POLICY_URL'
  | 'BRAND_LEGAL_ENTITY'
  | 'SOURCE_CODE_URL'
>;

@Injectable()
export class WhiteLabelService implements OnModuleInit {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  onModuleInit() {
    setEmailBranding(this.getBranding());
  }

  getBranding(): Branding {
    const serverUrl = this.twentyConfigService.get('SERVER_URL');
    const frontUrl = this.twentyConfigService.get('FRONTEND_URL') ?? serverUrl;

    return {
      name: this.twentyConfigService.get('BRAND_NAME'),
      logoUrl:
        this.getOptional('BRAND_LOGO_URL') ??
        new URL(BUNDLED_LOGO_PATH, frontUrl).toString(),
      websiteUrl: this.getOptional('BRAND_WEBSITE_URL'),
      supportUrl: this.getOptional('BRAND_SUPPORT_URL'),
      documentationUrl: this.getOptional('BRAND_DOCUMENTATION_URL'),
      termsOfServiceUrl: this.getOptional('BRAND_TERMS_OF_SERVICE_URL'),
      privacyPolicyUrl: this.getOptional('BRAND_PRIVACY_POLICY_URL'),
      legalEntity: this.getOptional('BRAND_LEGAL_ENTITY'),
      sourceCodeUrl:
        this.getOptional('SOURCE_CODE_URL') ??
        new URL('/source-code', serverUrl).toString(),
    };
  }

  private getOptional(key: OptionalBrandingConfigKey): string | null {
    const value = this.twentyConfigService.get(key);

    return isNonEmptyString(value) ? value : null;
  }
}
