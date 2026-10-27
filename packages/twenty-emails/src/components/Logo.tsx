import { type I18n } from '@lingui/core';
import { Img } from 'react-email';
import { isDefined } from 'twenty-shared/utils';

import { getEmailBranding } from 'src/utils/email-branding';

const logoStyle = {
  marginBottom: '40px',
};

type LogoProps = {
  i18n: I18n;
};

export const Logo = ({ i18n }: LogoProps) => {
  const { logoUrl } = getEmailBranding();

  if (!isDefined(logoUrl)) {
    return null;
  }

  return (
    <Img
      src={logoUrl}
      alt={i18n._('Twenty logo')}
      width="40"
      height="40"
      style={logoStyle}
    />
  );
};
