// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import lodash from 'lodash';
import type { ConversationModel } from '../models/conversations.preload.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { ConversationAttributesType } from '../model-types.d.ts';
import type { GroupNameCollisionsWithIdsByTitle } from './groupMemberNameCollisions.std.js';
import { StorySendMode } from '../types/Stories.std.js';
import { areWeAdmin } from './areWeAdmin.preload.js';
import { buildGroupLink } from '../groups.preload.js';
import { canAddNewMembers } from './canAddNewMembers.preload.js';
import { canBeAnnouncementGroup } from './canBeAnnouncementGroup.dom.js';
import { canChangeTimer } from './canChangeTimer.preload.js';
import { canEditGroupInfo } from './canEditGroupInfo.preload.js';
import { dropNull } from './dropNull.std.js';
import { getAboutText } from './getAboutText.dom.js';
import {
  getAvatarHash,
  getLocalAvatarUrl,
  getLocalProfileAvatarUrl,
  getRawAvatarPath,
  hasAvatar,
} from './avatarUtils.preload.js';
import { getAvatarData } from './getAvatarData.dom.js';
import { getConversationMembers } from './getConversationMembers.dom.js';
import { getCustomColorData, migrateColor } from './migrateColor.node.js';
import { getDraftPreview } from './getDraftPreview.preload.js';
import { getLastMessage } from './getLastMessage.preload.js';
import {
  getNumber,
  getProfileName,
  getTitle,
  getTitleNoDefault,
  canHaveUsername,
  renderNumber,
} from './getTitle.preload.js';
import { hasDraft } from './hasDraft.std.js';
import { isAciString } from './isAciString.std.js';
import { isBlocked } from './isBlocked.preload.js';
import { isConversationAccepted } from './isConversationAccepted.preload.js';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
  isMe,
} from './whatTypeOfConversation.dom.js';
import {
  areWePending,
  getBannedMemberships,
  getMembersCount,
  getMemberships,
  getPendingApprovalMemberships,
  getPendingMemberships,
  isMemberAwaitingApproval,
} from './groupMembershipUtils.preload.js';
import { isNotNil } from './isNotNil.std.js';
import { getIdentifierHash } from '../Crypto.node.js';
import { getAvatarPlaceholderGradient } from '../utils/getAvatarPlaceholderGradient.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { sortBy } = lodash;

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
  const typingValues = sortBy(
    Object.values(model.contactTypingTimers || {}),
    'timestamp'
  );
  const typingContactIdTimestamps = Object.fromEntries(
    typingValues.map(({ senderId, timestamp }) => [senderId, timestamp])
  );

  const ourAci = itemStorage.user.getAci();

  const identifierHash = getIdentifierHash({
    aci: isAciString(attributes.serviceId) ? attributes.serviceId : undefined,
    e164: attributes.e164,
    pni: attributes.pni,
    groupId: attributes.groupId,
  });

  const color = migrateColor(attributes.color, {
    aci: isAciString(attributes.serviceId) ? attributes.serviceId : undefined,
    e164: attributes.e164,
    pni: attributes.pni,
    groupId: attributes.groupId,
  });

  const avatarPlaceholderGradient =
    hasAvatar(attributes) && identifierHash != null
      ? getAvatarPlaceholderGradient(identifierHash)
      : undefined;

  const { draftTimestamp, draftEditMessage, timestamp } = attributes;
  const draftPreview = getDraftPreview(attributes);
  const draftText = dropNull(attributes.draft);
  const shouldShowDraft = Boolean(
    hasDraft(attributes) && draftTimestamp && draftTimestamp >= (timestamp || 0)
  );
  const inboxPosition = attributes.inbox_position;
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

  const isItMe = isMe(attributes);

  // TODO: DESKTOP-720
  return {
    id: attributes.id,
    serviceId: attributes.serviceId,
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
    areWePending: areWePending(attributes),
    areWePendingApproval: Boolean(
      ourConversationId &&
        ourAci &&
        isMemberAwaitingApproval(attributes, ourAci)
    ),
    areWeAdmin: areWeAdmin(attributes),
    avatarPlaceholderGradient,
    avatars: getAvatarData(attributes),
    badges: attributes.badges ?? EMPTY_ARRAY,
    canChangeTimer: canChangeTimer(attributes),
    canEditGroupInfo: canEditGroupInfo(attributes),
    canAddNewMembers: canAddNewMembers(attributes),
    avatarUrl: getLocalAvatarUrl(attributes),
    rawAvatarPath: getRawAvatarPath(attributes),
    avatarHash: getAvatarHash(attributes),
    profileAvatarUrl: getLocalProfileAvatarUrl(attributes),
    hasAvatar: hasAvatar(attributes),
    color,
    conversationColor: attributes.conversationColor,
    customColor,
    customColorId,
    discoveredUnregisteredAt: attributes.discoveredUnregisteredAt,
    draftBodyRanges: attributes.draftBodyRanges,
    draftPreview,
    draftText,
    draftEditMessage,
    familyName: attributes.nicknameFamilyName ?? attributes.profileFamilyName,
    firstName: attributes.nicknameGivenName ?? attributes.profileName,
    groupDescription: attributes.description,
    groupVersion,
    groupId: attributes.groupId,
    groupLink: buildGroupLink(attributes),
    hideStory: Boolean(attributes.hideStory),
    inboxPosition,
    isArchived: attributes.isArchived,
    isBlocked: isBlocked(attributes),
    reportingToken: attributes.reportingToken,
    removalStage: attributes.removalStage,
    isMe: isItMe,
    isGroupV1AndDisabled: isGroupV1(attributes),
    isPinned: attributes.isPinned,
    isUntrusted: model.isUntrusted(),
    isVerified: model.isVerified(),
    isFetchingUUID: model.isFetchingUUID,
    lastMessage: getLastMessage(attributes),
    lastMessageReceivedAt: attributes.lastMessageReceivedAt,
    lastMessageReceivedAtMs: attributes.lastMessageReceivedAtMs,
    lastUpdated: dropNull(timestamp),
    left: Boolean(attributes.left),
    markedUnread: attributes.markedUnread,
    membersCount: getMembersCount(attributes),
    memberships: getMemberships(attributes),
    messagesDeleted: Boolean(attributes.messagesDeleted),
    hasMessages: (attributes.messageCount ?? 0) > 0,
    pendingMemberships: getPendingMemberships(attributes),
    pendingApprovalMemberships: getPendingApprovalMemberships(attributes),
    bannedMemberships: getBannedMemberships(attributes),
    profileKey: attributes.profileKey,
    accessControlAddFromInviteLink: attributes.accessControl?.addFromInviteLink,
    accessControlAttributes: attributes.accessControl?.attributes,
    accessControlMembers: attributes.accessControl?.members,
    announcementsOnly: Boolean(attributes.announcementsOnly),
    announcementsOnlyReady: canBeAnnouncementGroup(attributes),
    expireTimer: attributes.expireTimer,
    muteExpiresAt: attributes.muteExpiresAt,
    dontNotifyForMentionsIfMuted: attributes.dontNotifyForMentionsIfMuted,
    nicknameFamilyName: dropNull(attributes.nicknameFamilyName),
    nicknameGivenName: dropNull(attributes.nicknameGivenName),
    note: dropNull(attributes.note),
    name: attributes.name,
    systemGivenName: attributes.systemGivenName,
    systemFamilyName: attributes.systemFamilyName,
    systemNickname: attributes.systemNickname,
    phoneNumber:
      isItMe && attributes.e164
        ? renderNumber(attributes.e164)
        : getNumber(attributes),
    profileName: getProfileName(attributes),
    profileSharing: attributes.profileSharing,
    profileLastUpdatedAt: attributes.profileLastUpdatedAt,
    capabilities: attributes.capabilities,
    sharingPhoneNumber: attributes.sharingPhoneNumber,
    publicParams: attributes.publicParams,
    secretParams: attributes.secretParams,
    shouldShowDraft,
    sortedGroupMembers,
    timestamp: dropNull(timestamp),
    title: getTitle(attributes),
    titleNoDefault: getTitleNoDefault(attributes),
    titleNoNickname: getTitle(attributes, { ignoreNickname: true }),
    titleShortNoDefault: getTitle(attributes, { isShort: true }),
    typingContactIdTimestamps,
    searchableTitle: isMe(attributes)
      ? window.SignalContext.i18n('icu:noteToSelf')
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
