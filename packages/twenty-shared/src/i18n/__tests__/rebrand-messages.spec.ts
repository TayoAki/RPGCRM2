import { rebrandMessages } from '@/i18n/rebrand-messages';

describe('rebrandMessages', () => {
  it('replaces the upstream product name in plain and compiled messages', () => {
    expect(
      rebrandMessages(
        {
          plain: 'Welcome to Twenty',
          compiled: ["Open Twenty's settings for ", ['workspaceName']],
        },
        'Acme CRM',
      ),
    ).toEqual({
      plain: 'Welcome to Acme CRM',
      compiled: ["Open Acme CRM's settings for ", ['workspaceName']],
    });
  });

  it('rebrands every branch of plural messages', () => {
    expect(
      rebrandMessages(
        {
          plural: [
            [
              'count',
              'plural',
              { one: ['One Twenty seat'], other: ['#', ' Twenty seats'] },
            ],
          ],
        },
        'Acme CRM',
      ),
    ).toEqual({
      plural: [
        [
          'count',
          'plural',
          { one: ['One Acme CRM seat'], other: ['#', ' Acme CRM seats'] },
        ],
      ],
    });
  });

  it('leaves other words and lowercase identifiers untouched', () => {
    expect(
      rebrandMessages(
        { app: 'e.g. my-twenty-app', compound: 'TwentyCRM stays' },
        'Acme CRM',
      ),
    ).toEqual({ app: 'e.g. my-twenty-app', compound: 'TwentyCRM stays' });
  });

  it('returns the same catalog when the brand is the upstream name', () => {
    const messages = { plain: 'Welcome to Twenty' };

    expect(rebrandMessages(messages, 'Twenty')).toBe(messages);
  });
});
