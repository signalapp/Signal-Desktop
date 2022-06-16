// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';
import { strictAssert } from '../../util/assert';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import type { PropsType } from './MessageSearchResult';
import { MessageSearchResult } from './MessageSearchResult';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/MessageSearchResult',
};

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
  snippet: text(
    'snippet',
    overrideProps.snippet || "What's <<left>>going<<right>> on?"
  ),
  body: text('body', overrideProps.body || "What's going on?"),
  bodyRanges: overrideProps.bodyRanges || [],
  from: overrideProps.from as PropsType['from'],
  to: overrideProps.to as PropsType['to'],
  getPreferredBadge: overrideProps.getPreferredBadge || (() => undefined),
  isSelected: boolean('isSelected', overrideProps.isSelected || false),
  showConversation: action('showConversation'),
  isSearchingInConversation: boolean(
    'isSearchingInConversation',
    overrideProps.isSearchingInConversation || false
  ),
  theme: React.useContext(StorybookThemeContext),
});

export const Default = (): JSX.Element => {
  const props = useProps({
    from: someone,
    to: me,
  });

  return <MessageSearchResult {...props} />;
};

export const SenderHasABadge = (): JSX.Element => {
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
};

SenderHasABadge.story = {
  name: 'Sender has a badge',
};

export const Selected = (): JSX.Element => {
  const props = useProps({
    from: someone,
    to: me,
    isSelected: true,
  });

  return <MessageSearchResult {...props} />;
};

export const FromYou = (): JSX.Element => {
  const props = useProps({
    from: me,
    to: someone,
  });

  return <MessageSearchResult {...props} />;
};

export const SearchingInConversation = (): JSX.Element => {
  const props = useProps({
    from: me,
    to: someone,
    isSearchingInConversation: true,
  });

  return <MessageSearchResult {...props} />;
};

SearchingInConversation.story = {
  name: 'Searching in Conversation',
};

export const FromYouToYourself = (): JSX.Element => {
  const props = useProps({
    from: me,
    to: me,
  });

  return <MessageSearchResult {...props} />;
};

FromYouToYourself.story = {
  name: 'From You to Yourself',
};

export const FromYouToGroup = (): JSX.Element => {
  const props = useProps({
    from: me,
    to: group,
  });

  return <MessageSearchResult {...props} />;
};

FromYouToGroup.story = {
  name: 'From You to Group',
};

export const FromSomeoneToGroup = (): JSX.Element => {
  const props = useProps({
    from: someone,
    to: group,
  });

  return <MessageSearchResult {...props} />;
};

FromSomeoneToGroup.story = {
  name: 'From Someone to Group',
};

export const LongSearchResult = (): JSX.Element => {
  const snippets = [
    'This is a really <<left>>detail<<right>>ed long line which will wrap and only be cut off after it gets to three lines. So maybe this will make it in as well?',
    "Okay, here are the <<left>>detail<<right>>s:\n\n1355 Ridge Way\nCode: 234\n\nI'm excited!",
  ];

  const props1 = useProps({
    from: someone,
    to: me,
    snippet: snippets[0],
  });

  const props2 = useProps({
    from: someone,
    to: me,
    snippet: snippets[1],
  });

  return (
    <>
      <MessageSearchResult {...props1} />
      <MessageSearchResult {...props2} />
    </>
  );
};

export const EmptyShouldBeInvalid = (): JSX.Element => {
  const props = useProps();

  return <MessageSearchResult {...props} />;
};

EmptyShouldBeInvalid.story = {
  name: 'Empty (should be invalid)',
};

export const Mention = (): JSX.Element => {
  const props = useProps({
    body: 'moss banana twine sound lake zoo brain count vacuum work stairs try power forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia bayonet vector orange forge diary zebra turtle rise front \uFFFC',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 113,
      },
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 237,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '...forget hair dry diary years no <<left>>results<<right>> \uFFFC <<left>>elephant<<right>> sorry umbrella potato igloo kangaroo home Georgia...',
  });

  return <MessageSearchResult {...props} />;
};

Mention.story = {
  name: '@mention',
};

export const MentionRegexp = (): JSX.Element => {
  const props = useProps({
    body: '\uFFFC This is a (long) /text/ ^$ that is ... specially **crafted** to (test) our regexp escaping mechanism! Making sure that the code we write works in all sorts of scenarios',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'RegExp',
        start: 0,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '\uFFFC This is a (long) /text/ ^$ that is ... <<left>>specially<<right>> **crafted** to (test) our regexp escaping mechanism...',
  });

  return <MessageSearchResult {...props} />;
};

MentionRegexp.story = {
  name: '@mention regexp',
};

export const MentionNoMatches = (): JSX.Element => {
  const props = useProps({
    body: '\uFFFC hello',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Neo',
        start: 0,
      },
    ],
    from: someone,
    to: me,
    snippet: '\uFFFC hello',
  });

  return <MessageSearchResult {...props} />;
};

MentionNoMatches.story = {
  name: '@mention no-matches',
};

export const _MentionNoMatches = (): JSX.Element => {
  const props = useProps({
    body: 'moss banana twine sound lake zoo brain count vacuum work stairs try power forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia bayonet vector orange forge diary zebra turtle rise front \uFFFC',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 113,
      },
      {
        length: 1,
        mentionUuid: '7d007e95-771d-43ad-9191-eaa86c773cb8',
        replacementText: 'Shoe',
        start: 237,
      },
    ],
    from: someone,
    to: me,
    snippet:
      '...forget hair dry diary years no results \uFFFC elephant sorry umbrella potato igloo kangaroo home Georgia...',
  });

  return <MessageSearchResult {...props} />;
};

_MentionNoMatches.story = {
  name: '@mention no-matches',
};

export const DoubleMention = (): JSX.Element => {
  const props = useProps({
    body: 'Hey \uFFFC \uFFFC test',
    bodyRanges: [
      {
        length: 1,
        mentionUuid: '9eb2eb65-992a-4909-a2a5-18c56bd7648f',
        replacementText: 'Alice',
        start: 4,
      },
      {
        length: 1,
        mentionUuid: '755ec61b-1590-48da-b003-3e57b2b54448',
        replacementText: 'Bob',
        start: 6,
      },
    ],
    from: someone,
    to: me,
    snippet: '<<left>>Hey<<right>> \uFFFC \uFFFC <<left>>test<<right>>',
  });

  return <MessageSearchResult {...props} />;
};

DoubleMention.story = {
  name: 'Double @mention',
};
