import { DEFAULT_BRANDING } from 'twenty-shared/constants';

import { applyBrandingToFrontendHtml } from 'src/engine/core-modules/white-label/utils/apply-branding-to-frontend-html.util';

const TEMPLATE = `<html><head>
<meta property="og:title" content="Twenty" />
<meta name="twitter:title" content="Twenty" />
<title>Twenty</title>
</head><body></body></html>`;

describe('applyBrandingToFrontendHtml', () => {
  it('replaces the document and social titles with the escaped brand name', () => {
    const html = applyBrandingToFrontendHtml(TEMPLATE, {
      ...DEFAULT_BRANDING,
      name: 'Acme & Co',
    });

    expect(html).toContain('<title>Acme &amp; Co</title>');
    expect(html).toContain(
      '<meta property="og:title" content="Acme &amp; Co" />',
    );
    expect(html).toContain(
      '<meta name="twitter:title" content="Acme &amp; Co" />',
    );
    expect(html).not.toContain('Twenty');
  });

  it('embeds the branding as JSON that cannot close the script tag', () => {
    const html = applyBrandingToFrontendHtml(TEMPLATE, {
      ...DEFAULT_BRANDING,
      name: '</script><script>alert(1)</script>',
    });

    const bootstrap = html.match(
      /<script id="white-label-branding" type="application\/json">(.*?)<\/script><\/head>/,
    );

    expect(bootstrap).not.toBeNull();
    expect(JSON.parse(bootstrap?.[1] ?? '').name).toBe(
      '</script><script>alert(1)</script>',
    );
  });
});
