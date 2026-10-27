import { BRANDING_BOOTSTRAP_ELEMENT_ID } from 'twenty-shared/constants';
import { type Branding } from 'twenty-shared/types';

import { escapeHtml } from 'src/engine/core-modules/emailing-domain/utils/escape-html.util';

const serializeForInlineScript = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export const applyBrandingToFrontendHtml = (
  html: string,
  branding: Branding,
): string => {
  const escapedName = escapeHtml(branding.name);

  return html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escapedName}</title>`)
    .replace(
      /(<meta\s+(?:property|name)="(?:og|twitter):title"\s+content=")[^"]*(")/g,
      (_match, prefix: string, suffix: string) =>
        `${prefix}${escapedName}${suffix}`,
    )
    .replace(
      '</head>',
      () =>
        `<script id="${BRANDING_BOOTSTRAP_ELEMENT_ID}" type="application/json">${serializeForInlineScript(branding)}</script></head>`,
    );
};
