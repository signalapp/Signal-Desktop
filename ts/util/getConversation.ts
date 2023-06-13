// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { head, sortBy } from 'lodash';
import type { ConversationModel } from '../models/conversations';
import type { ConversationType } from '../state/ducks/conversations';
import type { ConversationAttributesType } from '../model-types';
import type { GroupNameCollisionsWithIdsByTitle } from './groupMemberNameCollisions';
import { StorySendMode } from '../types/Stories';
import { UUIDKind } from '../types/UUID';
import { areWeAdmin } from './areWeAdmin';
import { buildGroupLink } from '../groups';
import { canAddNewMembers } from './canAddNewMembers';
import { canBeAnnouncementGroup } from './canBeAnnouncementGroup';
import { canChangeTimer } from './canChangeTimer';
import { canEditGroupInfo } from './canEditGroupInfo';
import { dropNull } from './dropNull';
import { getAboutText } from './getAboutText';
import {
  getAbsoluteAvatarPath,
  getAbsoluteUnblurredAvatarPath,
  getAbsoluteProfileAvatarPath,
  getAvatarHash,
} from './avatarUtils';
import { getAvatarData } from './getAvatarData';
import { getConversationMembers } from './getConversationMembers';
import { getCustomColorData, migrateColor } from './migrateColor';
import { getDraftPreview } from './getDraftPreview';
import { getLastMessage } from './getLastMessage';
import {
  getNumber,
  getProfileName,
  getTitle,
  getTitleNoDefault,
  canHaveUsername,
} from './getTitle';
import { hasDraft } from './hasDraft';
import { isBlocked } from './isBlocked';
import { isConversationAccepted } from './isConversationAccepted';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
  isMe,
} from './whatTypeOfConversation';
import {
  getBannedMemberships,
  getMembersCount,
  getMemberships,
  getPendingApprovalMemberships,
  getPendingMemberships,
  isMember,
  isMemberAwaitingApproval,
  isMemberPending,
} from './groupMembershipUtils';
import { isNotNil } from './isNotNil';

const EMPTY_ARRAY: Readonly<[]> = [];
const EMPTY_GROUP_COLLISIONS: GroupNameCollisionsWithIdsByTitle = {};

const getCollator = memoizee((): Intl.Collator => {
  return new Intl.Collator(undefined, { sensitivity: 'base' });
});

function sortConversationTitles(
  left: ConversationAttributesType,
  right: ConversationAttributesType
) {
  return getCollator().compare(getTitle(left), getTitle(right));
}

// Note: this should never be called directly. Use conversation.format() instead, which
//   maintains a cache, and protects against reentrant calls.
// Note: When writing code inside this function, do not call .format() on a conversation
//   unless you are sure that it's not this very same conversation.
// Note: If you start relying on an attribute that is in
//   `ATTRIBUTES_THAT_DONT_INVALIDATE_PROPS_CACHE`, remove it from that list.
export function getConversation(model: ConversationModel): ConversationType {
  const { attributes } = model;
  const typingValues = Object.values(model.contactTypingTimers || {});
  const typingMostRecent = head(sortBy(typingValues, 'timestamp'));

  const ourACI = window.textsecure.storage.user.getUuid(UUIDKind.ACI);
  const ourPNI = window.textsecure.storage.user.getUuid(UUIDKind.PNI);

  const color = migrateColor(attributes.color);

  const { draftTimestamp, draftEditMessage, timestamp } = attributes;
  const draftPreview = getDraftPreview(attributes);
  const draftText = dropNull(attributes.draft);
  const shouldShowDraft = Boolean(
    hasDraft(attributes) && draftTimestamp && draftTimestamp >= (timestamp || 0)
  );
  const inboxPosition = attributes.inbox_position;
  const messageRequestsEnabled = window.Signal.RemoteConfig.isEnabled(
    'desktop.messageRequests'
  );
  const ourConversationId =
    window.ConversationController.getOurConversationId();

  let groupVersion: undefined | 1 | 2;
  if (isGroupV1(attributes)) {
    groupVersion = 1;
  } else if (isGroupV2(attributes)) {
    groupVersion = 2;
  }

  const sortedGroupMembers = isGroupV2(attributes)
    ? getConversationMembers(attributes)
        .sort((left, right) => sortConversationTitles(left, right))
        .map(member => window.ConversationController.get(member.id)?.format())
        .filter(isNotNil)
    : undefined;

  const { customColor, customColorId } = getCustomColorData(attributes);

  // TODO: DESKTOP-720
  return {
    id: attributes.id,
    uuid: attributes.uuid,
    pni: attributes.pni,
    e164: attributes.e164,

    // We had previously stored `null` instead of `undefined` in some cases. We should
    //   be able to remove this `dropNull` once usernames have gone to production.
    username: canHaveUsername(attributes, ourConversationId)
      ? dropNull(attributes.username)
      : undefined,

    about: getAboutText(attributes),
    aboutText: attributes.about,
    aboutEmoji: attributes.aboutEmoji,
    acceptedMessageRequest: isConversationAccepted(attributes),
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    activeAt: attributes.active_at!,
    areWePending:
      ourACI &&
      (isMemberPending(attributes, ourACI) ||
        Boolean(
          ourPNI &&
            !isMember(attributes, ourACI) &&
            isMemberPending(attributes, ourPNI)
        )),
    areWePendingApproval: Boolean(
      ourConversationId &&
        ourACI &&
        isMemberAwaitingApproval(attributes, ourACI)
    ),
    areWeAdmin: areWeAdmin(attributes),
    avatars: getAvatarData(attributes),
    badges: attributes.badges ?? EMPTY_ARRAY,
    canChangeTimer: canChangeTimer(attributes),
    canEditGroupInfo: canEditGroupInfo(attributes),
    canAddNewMembers: canAddNewMembers(attributes),
    avatarPath: getAbsoluteAvatarPath(attributes),
    avatarHash: getAvatarHash(attributes),
    unblurredAvatarPath: getAbsoluteUnblurredAvatarPath(attributes),
    profileAvatarPath: getAbsoluteProfileAvatarPath(attributes),
    color,
    conversationColor: attributes.conversationColor,
    customColor,
    customColorId,
    discoveredUnregisteredAt: attributes.discoveredUnregisteredAt,
    draftBodyRanges: attributes.draftBodyRanges,
    draftPreview,
    draftText,
    draftEditMessage,
    familyName: attributes.profileFamilyName,
    firstName: attributes.profileName,
    groupDescription: attributes.description,
    groupVersion,
    groupId: attributes.groupId,
    groupLink: buildGroupLink(attributes),
    hideStory: Boolean(attributes.hideStory),
    inboxPosition,
    isArchived: attributes.isArchived,
    isBlocked: isBlocked(attributes),
    removalStage: attributes.removalStage,
    isMe: isMe(attributes),
    isGroupV1AndDisabled: isGroupV1(attributes),
    isPinned: attributes.isPinned,
    isUntrusted: model.isUntrusted(),
    isVerified: model.isVerified(),
    isFetchingUUID: model.isFetchingUUID,
    lastMessage: getLastMessage(attributes),
    lastUpdated: dropNull(timestamp),
    left: Boolean(attributes.left),
    markedUnread: attributes.markedUnread,
    membersCount: getMembersCount(attributes),
    memberships: getMemberships(attributes),
    hasMessages: (attributes.messageCount ?? 0) > 0,
    pendingMemberships: getPendingMemberships(attributes),
    pendingApprovalMemberships: getPendingApprovalMemberships(attributes),
    bannedMemberships: getBannedMemberships(attributes),
    profileKey: attributes.profileKey,
    messageRequestsEnabled,
    accessControlAddFromInviteLink: attributes.accessControl?.addFromInviteLink,
    accessControlAttributes: attributes.accessControl?.attributes,
    accessControlMembers: attributes.accessControl?.members,
    announcementsOnly: Boolean(attributes.announcementsOnly),
    announcementsOnlyReady: canBeAnnouncementGroup(attributes),
    expireTimer: attributes.expireTimer,
    muteExpiresAt: attributes.muteExpiresAt,
    dontNotifyForMentionsIfMuted: attributes.dontNotifyForMentionsIfMuted,
    name: attributes.name,
    systemGivenName: attributes.systemGivenName,
    systemFamilyName: attributes.systemFamilyName,
    systemNickname: attributes.systemNickname,
    phoneNumber: getNumber(attributes),
    profileName: getProfileName(attributes),
    profileSharing: attributes.profileSharing,
    publicParams: attributes.publicParams,
    secretParams: attributes.secretParams,
    shouldShowDraft,
    sortedGroupMembers,
    timestamp: dropNull(timestamp),
    title: getTitle(attributes),
    titleNoDefault: getTitleNoDefault(attributes),
    typingContactId: typingMostRecent?.senderId,
    searchableTitle: isMe(attributes)
      ? window.i18n('icu:noteToSelf')
      : getTitle(attributes),
    unreadCount: attributes.unreadCount || 0,
    unreadMentionsCount: attributes.unreadMentionsCount || 0,
    ...(isDirectConversation(attributes)
      ? {
          type: 'direct' as const,
          sharedGroupNames: attributes.sharedGroupNames || EMPTY_ARRAY,
        }
      : {
          type: 'group' as const,
          acknowledgedGroupNameCollisions:
            attributes.acknowledgedGroupNameCollisions ||
            EMPTY_GROUP_COLLISIONS,
          sharedGroupNames: EMPTY_ARRAY,
          storySendMode: attributes.storySendMode ?? StorySendMode.IfActive,
        }),
    voiceNotePlaybackRate: attributes.voiceNotePlaybackRate,
  };
}
