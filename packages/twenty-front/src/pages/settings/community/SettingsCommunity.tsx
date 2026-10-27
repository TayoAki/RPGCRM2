import { SettingsCard } from '@/settings/components/SettingsCard';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsLabContent } from '@/settings/lab/components/SettingsLabContent';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { getDocumentationUrl } from '@/support/utils/getDocumentationUrl';
import { BRANDING } from '@/white-label/constants/Branding';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Section } from 'twenty-ui/components/layout';
import {
  IconCodeCircle,
  type IconComponent,
  IconHelpCircle,
  IconLifebuoy,
  IconWorld,
} from 'twenty-ui/icon';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { MOBILE_VIEWPORT, useTheme, themeCssVariables } from 'twenty-ui/theme';

const StyledCardsGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: repeat(2, minmax(0, 1fr));

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    grid-template-columns: 1fr;
  }
`;

type SettingsCommunityLink = {
  href: string;
  Icon: IconComponent;
  cardTitle: string;
};

export const SettingsCommunity = () => {
  const theme = useTheme();

  const resourceLinks: SettingsCommunityLink[] = [
    ...(isDefined(BRANDING.websiteUrl)
      ? [{ href: BRANDING.websiteUrl, Icon: IconWorld, cardTitle: t`Website` }]
      : []),
    {
      href: getDocumentationUrl({}),
      Icon: IconHelpCircle,
      cardTitle: t`Documentation`,
    },
    ...(isDefined(BRANDING.supportUrl)
      ? [
          {
            href: BRANDING.supportUrl,
            Icon: IconLifebuoy,
            cardTitle: t`Support`,
          },
        ]
      : []),
    {
      href: BRANDING.sourceCodeUrl,
      Icon: IconCodeCircle,
      cardTitle: t`Source code`,
    },
  ];

  return (
    <SettingsPageLayout
      title={t`Community`}
      links={[
        {
          children: t`Other`,
          href: getSettingsPath(SettingsPath.Community),
        },
        { children: t`Community` },
      ]}
    >
      <SettingsPageContainer>
        <Section.Root>
          <Section.Header
            title={t`Resources`}
            description={t`Help, documentation and the source code of this app.`}
          />
          <StyledCardsGrid>
            {resourceLinks.map(({ href, Icon, cardTitle }) => (
              <SettingsCard
                key={href}
                href={href}
                Icon={
                  <Icon
                    size={theme.icon.size.md}
                    stroke={theme.icon.stroke.sm}
                  />
                }
                title={cardTitle}
              />
            ))}
          </StyledCardsGrid>
        </Section.Root>

        <Section.Root>
          <Section.Header
            title={t`Features`}
            description={t`Try our upcoming features. Note they are still in beta. Please bear with us and report any issues you find.`}
          />
          <SettingsLabContent />
        </Section.Root>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
