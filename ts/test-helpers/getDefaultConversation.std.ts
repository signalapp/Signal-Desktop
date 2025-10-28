// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import casual from 'casual';
import lodash from 'lodash';
import { v4 as generateUuid } from 'uuid';

import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { ServiceIdString } from '../types/ServiceId.std.js';
import { generateAci } from '../types/ServiceId.std.js';
import type { GroupListItemConversationType } from '../components/conversationList/GroupListItem.dom.js';
import { getRandomColor } from './getRandomColor.std.js';
import { ConversationColors } from '../types/Colors.std.js';
import { StorySendMode } from '../types/Stories.std.js';
import { getAvatarPlaceholderGradient } from '../utils/getAvatarPlaceholderGradient.std.js';

const { sample } = lodash;

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
    avatarPlaceholderGradient: getAvatarPlaceholderGradient(0),
    acceptedMessageRequest: true,
    avatarUrl: getAvatarPath(),
    badges: [],
    e164: `+${casual.phone.replace(/-/g, '')}`,
    conversationColor: ConversationColors[0],
    color: getRandomColor(),
    firstName,
    id: generateUuid(),
    isMe: false,
    lastUpdated: casual.unix_time,
    markedUnread: Boolean(overrideProps.markedUnread),
    sharedGroupNames: [],
    title: `${firstName} ${lastName}`,
    titleNoDefault: `${firstName} ${lastName}`,
    titleShortNoDefault: firstName,
    serviceId: generateAci(),
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
    aci: generateAci(),
    isAdmin: Boolean(casual.coin_flip),
  }));

  return {
    acceptedMessageRequest: true,
    announcementsOnly: false,
    avatarUrl: getAvatarPath(),
    badges: [],
    color: getRandomColor(),
    conversationColor: ConversationColors[0],
    groupDescription: casual.sentence,
    groupId: generateUuid(),
    groupLink: casual.url,
    groupVersion: 2,
    id: generateUuid(),
    isMe: false,
    lastUpdated: casual.unix_time,
    markedUnread: Boolean(overrideProps.markedUnread),
    membersCount: memberships.length,
    memberships,
    sharedGroupNames: [],
    title: casual.title,
    serviceId: generateAci(),
    acknowledgedGroupNameCollisions: {},
    storySendMode: StorySendMode.IfActive,
    ...overrideProps,
    type: 'group' as const,
  };
}

export function getDefaultConversationWithServiceId(
  overrideProps: Partial<ConversationType> = {},
  serviceId: ServiceIdString = generateAci()
): ConversationType & { serviceId: ServiceIdString } {
  return {
    ...getDefaultConversation(overrideProps),
    serviceId,
  };
}
