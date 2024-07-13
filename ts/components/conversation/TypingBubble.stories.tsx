// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { TypingBubblePropsType } from './TypingBubble';
import { TypingBubble } from './TypingBubble';
import { AvatarColors } from '../../types/Colors';
import { getFakeBadge } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/TypingBubble',
  argTypes: {},
  args: {},
} satisfies Meta<TypingBubblePropsType>;

const CONTACTS = times(10, index => {
  const letter = (index + 10).toString(36).toUpperCase();
  return getDefaultConversation({
    id: `contact-${index}`,
    acceptedMessageRequest: false,
    avatarUrl: '',
    badges: [],
    color: AvatarColors[index],
    name: `${letter} ${letter}`,
    phoneNumber: '(202) 555-0001',
    profileName: `${letter} ${letter}`,
    isMe: false,
    sharedGroupNames: [],
    title: `${letter} ${letter}`,
  });
});
const CONTACT_IDS = CONTACTS.map(contact => contact.id);
const CONTACTS_BY_ID = new Map(CONTACTS.map(contact => [contact.id, contact]));
const getConversation = (id: string) =>
  CONTACTS_BY_ID.get(id) || getDefaultConversation();

const CONTACTS_WITH_BADGES = CONTACTS.map(contact => {
  return { ...contact, badges: [getFakeBadge()] };
});
const CONTACTS_WITH_BADGES_BY_ID = new Map(
  CONTACTS_WITH_BADGES.map(contact => [contact.id, contact])
);
const getConversationWithBadges = (id: string) =>
  CONTACTS_WITH_BADGES_BY_ID.get(id) || getDefaultConversation();

const getTypingContactIdTimestamps = (count: number) =>
  Object.fromEntries(CONTACT_IDS.slice(0, count).map(id => [id, Date.now()]));

const createProps = (
  overrideProps: Partial<TypingBubblePropsType> = {}
): TypingBubblePropsType => {
  return {
    typingContactIdTimestamps:
      overrideProps.typingContactIdTimestamps ??
      getTypingContactIdTimestamps(1),
    lastItemAuthorId: '123',
    lastItemTimestamp: undefined,
    i18n,
    conversationId: '123',
    conversationType: overrideProps.conversationType ?? 'direct',
    getConversation: overrideProps.getConversation || getConversation,
    getPreferredBadge: badges =>
      badges.length > 0 ? getFakeBadge() : undefined,
    showContactModal: action('showContactModal'),
    theme: ThemeType.light,
  };
};

export function Direct(): JSX.Element {
  const props = createProps();

  return <TypingBubble {...props} />;
}

export function DirectStoppedTyping(): JSX.Element {
  const props = createProps();
  const [afterTimeoutProps, setAfterTimeoutProps] = useState({});
  useEffect(() => {
    setTimeout(
      () =>
        setAfterTimeoutProps({
          typingContactIdTimestamps: {},
        }),
      500
    );
  }, []);

  return <TypingBubble {...props} {...afterTimeoutProps} />;
}

export function Group(): JSX.Element {
  const props = createProps({ conversationType: 'group' });
  return <TypingBubble {...props} />;
}

export function GroupStartsTyping(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: {},
  });
  const [afterTimeoutProps, setAfterTimeoutProps] = useState({});
  useEffect(() => {
    setTimeout(
      () =>
        setAfterTimeoutProps({
          typingContactIdTimestamps: getTypingContactIdTimestamps(1),
        }),
      500
    );
  }, []);

  return <TypingBubble {...props} {...afterTimeoutProps} />;
}

export function GroupStoppedTyping(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: getTypingContactIdTimestamps(1),
  });
  const [afterTimeoutProps, setAfterTimeoutProps] = useState({});
  useEffect(() => {
    setTimeout(
      () => setAfterTimeoutProps({ typingContactIdTimestamps: {} }),
      500
    );
  }, []);

  return <TypingBubble {...props} {...afterTimeoutProps} />;
}

export function GroupWithBadge(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: getTypingContactIdTimestamps(1),
    getConversation: getConversationWithBadges,
  });

  return <TypingBubble {...props} />;
}

export function GroupMultiTyping1To2(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: getTypingContactIdTimestamps(1),
  });
  const [afterTimeoutProps, setAfterTimeoutProps] = useState({});
  useEffect(() => {
    setTimeout(
      () =>
        setAfterTimeoutProps({
          typingContactIdTimestamps: getTypingContactIdTimestamps(2),
        }),
      500
    );
  }, []);

  return <TypingBubble {...props} {...afterTimeoutProps} />;
}

export function GroupMultiTyping2Then1PersonStops(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: getTypingContactIdTimestamps(2),
  });
  const [afterTimeoutProps, setAfterTimeoutProps] = useState({});
  useEffect(() => {
    setTimeout(
      () =>
        setAfterTimeoutProps({
          typingContactIdTimestamps: getTypingContactIdTimestamps(1),
        }),
      500
    );
  }, []);

  return <TypingBubble {...props} {...afterTimeoutProps} />;
}

export function GroupMultiTyping3To4(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: getTypingContactIdTimestamps(3),
  });
  const [afterTimeoutProps, setAfterTimeoutProps] = useState({});
  useEffect(() => {
    setTimeout(
      () =>
        setAfterTimeoutProps({
          typingContactIdTimestamps: getTypingContactIdTimestamps(4),
        }),
      500
    );
  }, []);

  return <TypingBubble {...props} {...afterTimeoutProps} />;
}

export function GroupMultiTyping10(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: getTypingContactIdTimestamps(10),
  });

  return <TypingBubble {...props} />;
}

export function GroupMultiTypingWithBadges(): JSX.Element {
  const props = createProps({
    conversationType: 'group',
    typingContactIdTimestamps: getTypingContactIdTimestamps(3),
    getConversation: getConversationWithBadges,
  });

  return <TypingBubble {...props} />;
}
