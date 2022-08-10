// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import casual from 'casual';
import { sample } from 'lodash';
import type { ConversationType } from '../../state/ducks/conversations';
import { UUID } from '../../types/UUID';
import type { UUIDStringType } from '../../types/UUID';
import { getRandomColor } from './getRandomColor';
import { ConversationColors } from '../../types/Colors';

export const getAvatarPath = (): string =>
  sample([
    '/fixtures/kitten-1-64-64.jpg',
    '/fixtures/kitten-2-64-64.jpg',
    '/fixtures/kitten-3-64-64.jpg',
  ]) || '';

export function getDefaultConversation(
  overrideProps: Partial<ConversationType> = {}
): ConversationType {
  const firstName = casual.first_name;
  const lastName = casual.last_name;

  return {
    acceptedMessageRequest: true,
    avatarPath: getAvatarPath(),
    badges: [],
    e164: `+${casual.phone.replace(/-/g, '')}`,
    conversationColor: ConversationColors[0],
    color: getRandomColor(),
    firstName,
    id: UUID.generate().toString(),
    isMe: false,
    lastUpdated: casual.unix_time,
    markedUnread: Boolean(overrideProps.markedUnread),
    sharedGroupNames: [],
    title: `${firstName} ${lastName}`,
    type: 'direct' as const,
    uuid: UUID.generate().toString(),
    ...overrideProps,
  };
}

export function getDefaultGroup(
  overrideProps: Partial<ConversationType> = {}
): ConversationType {
  const memberships = Array.from(Array(casual.integer(1, 20)), () => ({
    uuid: UUID.generate().toString(),
    isAdmin: Boolean(casual.coin_flip),
  }));

  return {
    acceptedMessageRequest: true,
    announcementsOnly: false,
    avatarPath: getAvatarPath(),
    badges: [],
    color: getRandomColor(),
    conversationColor: ConversationColors[0],
    groupDescription: casual.sentence,
    groupId: UUID.generate().toString(),
    groupLink: casual.url,
    groupVersion: 2,
    id: UUID.generate().toString(),
    isMe: false,
    lastUpdated: casual.unix_time,
    markedUnread: Boolean(overrideProps.markedUnread),
    membersCount: memberships.length,
    memberships,
    sharedGroupNames: [],
    title: casual.title,
    type: 'group' as const,
    uuid: UUID.generate().toString(),
    ...overrideProps,
  };
}

export function getDefaultConversationWithUuid(
  overrideProps: Partial<ConversationType> = {},
  uuid: UUIDStringType = UUID.generate().toString()
): ConversationType & { uuid: UUIDStringType } {
  return {
    ...getDefaultConversation(overrideProps),
    uuid,
  };
}
