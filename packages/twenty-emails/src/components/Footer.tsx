import { type I18n } from '@lingui/core';
import { Column, Container, Row } from 'react-email';
import { isDefined } from 'twenty-shared/utils';

import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';
import { getEmailBranding } from 'src/utils/email-branding';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
};

export const Footer = ({ i18n }: FooterProps) => {
  const { websiteUrl, documentationUrl, legalEntity } = getEmailBranding();

  return (
    <Container style={footerContainerStyle}>
      <Row>
        {isDefined(websiteUrl) && (
          <Column>
            <ShadowText>
              <Link
                href={websiteUrl}
                value={i18n._('Website')}
                aria-label={i18n._("Visit Twenty's website")}
              />
            </ShadowText>
          </Column>
        )}
        {isDefined(documentationUrl) && (
          <Column>
            <ShadowText>
              <Link
                href={documentationUrl}
                value={i18n._('User guide')}
                aria-label={i18n._("Read Twenty's user guide")}
              />
            </ShadowText>
          </Column>
        )}
      </Row>
      {isDefined(legalEntity) && <ShadowText>{legalEntity}</ShadowText>}
    </Container>
  );
};
