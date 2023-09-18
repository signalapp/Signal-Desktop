// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';
import { select } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType as TypingBubblePropsType } from './TypingBubble';
import { TypingBubble } from './TypingBubble';
import { AvatarColors } from '../../types/Colors';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/TypingBubble',
};

type TypingContactType = TypingBubblePropsType['typingContacts'][number];

const contacts: Array<TypingContactType> = times(10, index => {
  const letter = (index + 10).toString(36).toUpperCase();
  return {
    id: `contact-${index}`,
    acceptedMessageRequest: false,
    avatarPath: '',
    badge: undefined,
    color: AvatarColors[index],
    name: `${letter} ${letter}`,
    phoneNumber: '(202) 555-0001',
    profileName: `${letter} ${letter}`,
    isMe: false,
    sharedGroupNames: [],
    title: `${letter} ${letter}`,
  };
});

const createProps = (
  overrideProps: Partial<TypingBubblePropsType> = {}
): TypingBubblePropsType => ({
  typingContacts: overrideProps.typingContacts || contacts.slice(0, 1),
  i18n,
  conversationId: '123',
  conversationType:
    overrideProps.conversationType ||
    select('conversationType', { group: 'group', direct: 'direct' }, 'direct'),
  showContactModal: action('showContactModal'),
  theme: ThemeType.light,
});

export function Direct(): JSX.Element {
  const props = createProps();

  return <TypingBubble {...props} />;
}

export function Group(): JSX.Element {
  const props = createProps({ conversationType: 'group' });

  return <TypingBubble {...props} />;
}

Group.story = {
  name: 'Group (1 person typing)',
};

export function GroupMultiTyping2(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContacts: contacts.slice(0, 2),
  });

  return <TypingBubble {...props} />;
}

export function GroupWithBadge(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContacts: contacts
      .slice(0, 1)
      .map(contact => ({ ...contact, badge: getFakeBadge() })),
  });

  return <TypingBubble {...props} />;
}

GroupWithBadge.story = {
  name: 'Group (with badge)',
};

GroupMultiTyping2.story = {
  name: 'Group (2 persons typing)',
};

export function GroupMultiTyping3(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContacts: contacts.slice(0, 3),
  });

  return <TypingBubble {...props} />;
}

GroupMultiTyping3.story = {
  name: 'Group (3 persons typing)',
};

export function GroupMultiTyping4(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContacts: contacts.slice(0, 4),
  });

  return <TypingBubble {...props} />;
}

GroupMultiTyping4.story = {
  name: 'Group (4 persons typing)',
};

export function GroupMultiTyping10(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContacts: contacts.slice(0, 10),
  });

  return <TypingBubble {...props} />;
}

GroupMultiTyping10.story = {
  name: 'Group (10 persons typing)',
};

export function GroupMultiTypingWithBadges(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContacts: [
      {
        ...contacts[0],
        badge: getFakeBadge(),
      },
      {
        ...contacts[1],
      },
      {
        ...contacts[2],
        badge: getFakeBadge(),
      },
    ],
  });

  return <TypingBubble {...props} />;
}

GroupMultiTypingWithBadges.story = {
  name: 'Group (3 persons typing, 2 persons have badge)',
};
