// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useMemo } from 'react';
import type { ConversationType } from '../state/ducks/conversations.preload.js';

type Primitive = undefined | null | boolean | number | bigint | string;
type PrimitiveObject = Record<string, Primitive>;
type Satisfies<Expected, Actual extends Expected> = Actual;

/**
 * This type is a subset of ConversationType that includes only the fields that
 * are not updated frequently and can be shallow compared. This is useful for
 * memoization, because it allows us to avoid re-rendering when the conversation
 * changes in ways that don't affect the UI.
 *
 * You are welcome to add to this type, as long as the value is a primitive
 * type (no objects or arrays), and it is not updated frequently.
 */
export type MinimalConversation = Satisfies<
  PrimitiveObject,
  Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'announcementsOnly'
    | 'areWeAdmin'
    | 'avatarUrl'
    | 'canChangeTimer'
    | 'color'
    | 'expireTimer'
    | 'groupVersion'
    | 'hasAvatar'
    | 'id'
    | 'isArchived'
    | 'isBlocked'
    | 'isMe'
    | 'isPinned'
    | 'isReported'
    | 'isVerified'
    | 'left'
    | 'markedUnread'
    | 'muteExpiresAt'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'title'
    | 'type'
  > & {
    gradientStart?: string;
    gradientEnd?: string;
  }
>;

export function useMinimalConversation(
  conversation: ConversationType
): MinimalConversation {
  const {
    acceptedMessageRequest,
    announcementsOnly,
    areWeAdmin,
    avatarUrl,
    canChangeTimer,
    color,
    expireTimer,
    groupVersion,
    hasAvatar,
    id,
    isArchived,
    isBlocked,
    isMe,
    isPinned,
    isReported,
    isVerified,
    left,
    markedUnread,
    muteExpiresAt,
    name,
    phoneNumber,
    profileName,
    title,
    type,
  } = conversation;
  const gradientStart = conversation.avatarPlaceholderGradient?.[0];
  const gradientEnd = conversation.avatarPlaceholderGradient?.[1];
  return useMemo((): MinimalConversation => {
    return {
      gradientStart,
      gradientEnd,
      acceptedMessageRequest,
      announcementsOnly,
      areWeAdmin,
      avatarUrl,
      canChangeTimer,
      color,
      expireTimer,
      groupVersion,
      hasAvatar,
      id,
      isArchived,
      isBlocked,
      isMe,
      isPinned,
      isReported,
      isVerified,
      left,
      markedUnread,
      muteExpiresAt,
      name,
      phoneNumber,
      profileName,
      title,
      type,
    };
  }, [
    gradientStart,
    gradientEnd,
    acceptedMessageRequest,
    announcementsOnly,
    areWeAdmin,
    avatarUrl,
    canChangeTimer,
    color,
    expireTimer,
    groupVersion,
    hasAvatar,
    id,
    isArchived,
    isBlocked,
    isMe,
    isPinned,
    isReported,
    isVerified,
    left,
    markedUnread,
    muteExpiresAt,
    name,
    phoneNumber,
    profileName,
    title,
    type,
  ]);
}
