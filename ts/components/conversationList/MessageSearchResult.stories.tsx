// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';
import { strictAssert } from '../../util/assert';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import type { PropsType } from './MessageSearchResult';
import { MessageSearchResult } from './MessageSearchResult';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { BodyRange } from '../../types/BodyRange';
import { generateAci } from '../../types/ServiceId';

const SERVICE_ID_1 = generateAci();
const SERVICE_ID_2 = generateAci();
const SERVICE_ID_3 = generateAci();

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MessageSearchResult',
} satisfies Meta<PropsType>;

const someone = getDefaultConversation({
  title: 'Some Person',
  name: 'Some Person',
  phoneNumber: '(202) 555-0011',
});

const me = getDefaultConversation({
  title: 'Me',
  name: 'Me',
  isMe: true,
});

const group = getDefaultConversation({
  title: 'Group Chat',
  name: 'Group Chat',
  type: 'group',
});

const useProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  id: '',
  conversationId: '',
  sentAt: Date.now() - 24 * 60 * 1000,
  snippet: overrideProps.snippet || "What's <<left>>going<<right>> on?",
  body: overrideProps.body || "What's going on?",
  bodyRanges: overrideProps.bodyRanges || [],
  from: overrideProps.from as PropsType['from'],
  to: overrideProps.to as PropsType['to'],
  getPreferredBadge: overrideProps.getPreferredBadge || (() => undefined),
  isSelected: overrideProps.isSelected || false,
  showConversation: action('showConversation'),
  isSearchingInConversation: overrideProps.isSearchingInConversation || false,
  theme: React.useContext(StorybookThemeContext),
});

export function Default(): JSX.Element {
  const props = useProps({
    from: someone,
    to: me,
  });

  return <MessageSearchResult {...props} />;
}

export function SenderHasABadge(): JSX.Element {
  const props = useProps({
    from: { ...someone, badges: [{ id: 'sender badge' }] },
    to: me,
    getPreferredBadge: badges => {
      strictAssert(
        badges[0]?.id === 'sender badge',
        'Rendering the wrong badge!'
      );
      return getFakeBadge();
    },
  });

  return <MessageSearchResult {...props} />;
}

export function Selected(): JSX.Element {
  const props = useProps({
    from: someone,
    to: me,
    isSelected: true,
  });

  return <MessageSearchResult {...props} />;
}

export function FromYou(): JSX.Element {
  const props = useProps({
    from: me,
    to: someone,
  });

  return <MessageSearchResult {...props} />;
}

export function SearchingInConversation(): JSX.Element {
  const props = useProps({
    from: me,
    to: someone,
    isSearchingInConversation: true,
  });

  return <MessageSearchResult {...props} />;
}

export function FromYouToYourself(): JSX.Element {
  const props = useProps({
    from: me,
    to: me,
  });

  return <MessageSearchResult {...props} />;
}

export function FromYouToGroup(): JSX.Element {
  const props = useProps({
    from: me,
    to: group,
  });

  return <MessageSearchResult {...props} />;
}

export function FromSomeoneToGroup(): JSX.Element {
  const props = useProps({
    from: someone,
    to: group,
  });

  return <MessageSearchResult {...props} />;
}

export function LongSearchResult(): JSX.Element {
  const props1 = useProps({
    from: someone,
    to: me,
    snippet:
      'This is a really <<left>>detail<<right>>ed long line which will wrap and only be cut off after it gets to three lines. So maybe this will make it in as well?',
    body: 'This is a really detailed long line which will wrap and only be cut off after it gets to three lines. So maybe this will make it in as well?',
  });

  const props2 = useProps({
    from: someone,
    to: me,
    snippet:
      "Okay, here are the <<left>>detail<<right>>s:\n\n1355 Ridge Way\nCode: 234\n\nI'm excited!",
    body: "Okay, here are the details:\n\n1355 Ridge Way\nCode: 234\n\nI'm excited!",
  });

  return (
    <>
      <MessageSearchResult {...props1} />
      <MessageSearchResult {...props2} />
    </>
  );
}

export function EmptyShouldBeInvalid(): JSX.Element {
  const props = useProps();

  return <MessageSearchResult {...props} />;
}

export function Mention(): JSX.Element {
  const props = useProps({
    body: 'moss banana twine sound lake zoo brain count vacuum work stairs try power forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia bayonet vector orange forge diary zebra turtle rise front \uFFFC',
    bodyRanges: [
      {
        length: 1,
        mentionAci: SERVICE_ID_3,
        replacementText: 'Shoe',
        conversationID: 'x',
        start: 113,
      },
      {
        length: 1,
        mentionAci: SERVICE_ID_3,
        replacementText: 'Shoe',
        conversationID: 'x',
        start: 237,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '<<truncation>>forget hair dry diary years no <<left>>results<<right>> \uFFFC <<left>>elephant<<right>> sorry umbrella potato igloo kangaroo home Georgia<<truncation>>',
  });

  return <MessageSearchResult {...props} />;
}

export function MentionRegexp(): JSX.Element {
  const props = useProps({
    body: '\uFFFC This is a (long) /text/ ^$ that is ... specially **crafted** to (test) our regexp escaping mechanism! Making sure that the code we write works in all sorts of scenarios',
    bodyRanges: [
      {
        length: 1,
        mentionAci: SERVICE_ID_3,
        replacementText: 'RegExp',
        conversationID: 'x',
        start: 0,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '\uFFFC This is a (long) /text/ ^$ that is ... <<left>>specially<<right>> **crafted** to (test) our regexp escaping mechanism<<truncation>>',
  });

  return <MessageSearchResult {...props} />;
}

export function MentionNoMatches(): JSX.Element {
  const props = useProps({
    body: '\uFFFC hello',
    bodyRanges: [
      {
        length: 1,
        mentionAci: SERVICE_ID_3,
        replacementText: 'Neo',
        conversationID: 'x',
        start: 0,
      },
    ],
    from: someone,
    to: me,
    snippet: '\uFFFC hello',
  });

  return <MessageSearchResult {...props} />;
}

export const _MentionNoMatches = (): JSX.Element => {
  const props = useProps({
    body: 'moss banana twine sound lake zoo brain count vacuum work stairs try power forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia bayonet vector orange forge diary zebra turtle rise front \uFFFC',
    bodyRanges: [
      {
        length: 1,
        mentionAci: SERVICE_ID_3,
        replacementText: 'Shoe',
        conversationID: 'x',
        start: 113,
      },
      {
        length: 1,
        mentionAci: SERVICE_ID_3,
        replacementText: 'Shoe',
        conversationID: 'x',
        start: 237,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '<<truncation>>forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia<<truncation>>',
  });

  return <MessageSearchResult {...props} />;
};

export function DoubleMention(): JSX.Element {
  const props = useProps({
    body: 'Hey \uFFFC \uFFFC --- test! Two mentions!',
    bodyRanges: [
      {
        length: 1,
        mentionAci: SERVICE_ID_2,
        replacementText: 'Alice',
        conversationID: 'x',
        start: 4,
      },
      {
        length: 1,
        mentionAci: SERVICE_ID_1,
        replacementText: 'Bob',
        conversationID: 'x',
        start: 6,
      },
    ],
    from: someone,
    to: me,
    snippet: '<<left>>Hey<<right>> \uFFFC \uFFFC --- test! <<truncation>>',
  });

  return <MessageSearchResult {...props} />;
}

export function WithFormatting(): JSX.Element {
  const props = useProps({
    body: "We're playing with formatting in fun ways like you do!",
    bodyRanges: [
      {
        // Overlaps just start
        start: 0,
        length: 19,
        style: BodyRange.Style.BOLD,
      },
      {
        // Contains snippet entirely
        start: 0,
        length: 54,
        style: BodyRange.Style.ITALIC,
      },
      {
        // Contained by snippet
        start: 19,
        length: 10,
        style: BodyRange.Style.MONOSPACE,
      },
      {
        // Overlaps just end
        start: 29,
        length: 25,
        style: BodyRange.Style.STRIKETHROUGH,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '<<truncation>>playing with formatting in <<left>>fun<<right>> ways<<truncation>>',
  });

  return <MessageSearchResult {...props} />;
}
