// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import casual from 'casual';
import { sample } from 'lodash';
import type { ConversationType } from '../../state/ducks/conversations';
import type { UUIDStringType } from '../../types/UUID';
import { UUID } from '../../types/UUID';
import type { GroupListItemConversationType } from '../../components/conversationList/GroupListItem';
import { getRandomColor } from './getRandomColor';
import { ConversationColors } from '../../types/Colors';
import { StorySendMode } from '../../types/Stories';

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
    titleNoDefault: `${firstName} ${lastName}`,
    uuid: UUID.generate().toString(),
    ...overrideProps,
    type: 'direct' as const,
    acknowledgedGroupNameCollisions: undefined,
    storySendMode: undefined,
  };
}

export function getDefaultGroupListItem(
  overrideProps: Partial<GroupListItemConversationType> = {}
): GroupListItemConversationType {
  return {
    ...getDefaultGroup(),
    disabledReason: undefined,
    membersCount: 24,
    memberships: [],
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
    uuid: UUID.generate().toString(),
    acknowledgedGroupNameCollisions: {},
    storySendMode: StorySendMode.IfActive,
    ...overrideProps,
    type: 'group' as const,
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
