import { i18n } from '@lingui/core';
import { rebrandMessages } from 'twenty-shared/i18n';
import {
  APP_LOCALES,
  getLocaleTextDirection,
  SOURCE_LOCALE,
} from 'twenty-shared/translations';
import { BRANDING } from '@/white-label/constants/Branding';

export const dynamicActivate = async (locale: keyof typeof APP_LOCALES) => {
  if (!Object.values(APP_LOCALES).includes(locale)) {
    // oxlint-disable-next-line no-console
    console.warn(`Invalid locale "${locale}", defaulting to "en"`);
    locale = SOURCE_LOCALE;
  }
  const { messages } = await import(`../../locales/generated/${locale}.ts`);
  i18n.load(locale, rebrandMessages(messages, BRANDING.name));
  i18n.activate(locale);

  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleTextDirection(locale);
};
