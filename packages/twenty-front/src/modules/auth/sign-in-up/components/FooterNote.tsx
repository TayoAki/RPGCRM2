import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import { Fragment, type ReactNode } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { useWorkspaceBypass } from '@/auth/sign-in-up/hooks/useWorkspaceBypass';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';
import { ONBOARDING_CONTENT_BLOCK_WIDTH } from '@/onboarding/constants/OnboardingContentBlockWidth';
import { BRANDING } from '@/white-label/constants/Branding';
import { themeCssVariables } from 'twenty-ui/theme';

const StyledCopyContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  max-width: ${ONBOARDING_CONTENT_BLOCK_WIDTH}px;
  text-align: center;

  & > a {
    color: ${themeCssVariables.font.color.tertiary};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const StyledLinksContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: nowrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  max-width: 100%;
  text-align: center;
  white-space: nowrap;

  & > a,
  & > button {
    background: none;
    border: none;
    color: ${themeCssVariables.font.color.tertiary};
    cursor: pointer;
    font: inherit;
    padding: 0;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const StyledSeparator = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

type ExternalLinkProps = {
  href: string;
  children: ReactNode;
};

const ExternalLink = ({ href, children }: ExternalLinkProps) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

export const FooterNote = () => {
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();
  const { termsOfServiceUrl, privacyPolicyUrl, sourceCodeUrl } = BRANDING;

  const { shouldOfferBypass, shouldUseBypass, enableBypass } =
    useWorkspaceBypass();

  const sourceCodeLink = (
    <ExternalLink href={sourceCodeUrl}>
      <Trans>Source code</Trans>
    </ExternalLink>
  );

  if (
    !isOnAWorkspace &&
    isDefined(termsOfServiceUrl) &&
    isDefined(privacyPolicyUrl)
  ) {
    return (
      <StyledCopyContainer>
        <Trans>By using Twenty, you agree to the</Trans>{' '}
        <ExternalLink href={termsOfServiceUrl}>
          <Trans>Terms of Service</Trans>
        </ExternalLink>{' '}
        <Trans>and</Trans>{' '}
        <ExternalLink href={privacyPolicyUrl}>
          <Trans>Privacy Policy</Trans>
        </ExternalLink>
        . {sourceCodeLink}
      </StyledCopyContainer>
    );
  }

  const links: { key: string; element: ReactNode }[] = [
    ...(shouldOfferBypass && !shouldUseBypass
      ? [
          {
            key: 'bypass-sso',
            element: (
              <button type="button" onClick={enableBypass}>
                <Trans>Bypass SSO</Trans>
              </button>
            ),
          },
        ]
      : []),
    ...(isDefined(privacyPolicyUrl)
      ? [
          {
            key: 'privacy-policy',
            element: (
              <ExternalLink href={privacyPolicyUrl}>
                <Trans>Privacy Policy</Trans>
              </ExternalLink>
            ),
          },
        ]
      : []),
    ...(isDefined(termsOfServiceUrl)
      ? [
          {
            key: 'terms-of-service',
            element: (
              <ExternalLink href={termsOfServiceUrl}>
                <Trans>Terms of Service</Trans>
              </ExternalLink>
            ),
          },
        ]
      : []),
    { key: 'source-code', element: sourceCodeLink },
  ];

  return (
    <StyledLinksContainer>
      {links.map(({ key, element }, index) => (
        <Fragment key={key}>
          {index > 0 && <StyledSeparator>•</StyledSeparator>}
          {element}
        </Fragment>
      ))}
    </StyledLinksContainer>
  );
};
