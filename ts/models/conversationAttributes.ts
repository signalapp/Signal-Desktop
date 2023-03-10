import { defaults } from 'lodash';
import { LastMessageStatusType } from '../state/ducks/conversations';

/**
 * Private chats have always the type `Private`
 * Open groups have always the type `Group`
 * Closed group have the type `Group` when they are not v3 and the type `CLOSED_GROUP` when they v3.
 * To identity between an open or closed group before v3, we need to rely on the prefix (05 is closed groups, 'http%' is opengroup)
 *
 *
 * We will need to support existing closed groups foir now, but we will be able to get rid of existing closed groups at some point.
 * When we do get rid of them, we will be able to remove any GROUP conversation with prefix 05 (as they are old closed groups) and update the remaining GROUP to be opengroups instead
 */
export enum ConversationTypeEnum {
  GROUP = 'group',
  GROUPV3 = 'groupv3',
  PRIVATE = 'private',
}

export function isOpenOrClosedGroup(conversationType: ConversationTypeEnum) {
  return (
    conversationType === ConversationTypeEnum.GROUP ||
    conversationType === ConversationTypeEnum.GROUPV3
  );
}

export function isDirectConversation(conversationType: ConversationTypeEnum) {
  return conversationType === ConversationTypeEnum.PRIVATE;
}

/**
 * all: all  notifications enabled, the default
 * disabled: no notifications at all
 * mentions_only: trigger a notification only on mentions of ourself
 */
export const ConversationNotificationSetting = ['all', 'disabled', 'mentions_only'] as const;
export type ConversationNotificationSettingType = typeof ConversationNotificationSetting[number];

/**
 * Soem fields are retrieved from the database as a select, but should not be saved in a commit()
 */
export type ConversationAttributesNotSaved = {
  mentionedUs: boolean;
  unreadCount: number;
};

export interface ConversationAttributes {
  id: string;
  type: ConversationTypeEnum.PRIVATE | ConversationTypeEnum.GROUPV3 | ConversationTypeEnum.GROUP;

  // 0 means inactive (undefined and null too but we try to get rid of them and only have 0 = inactive)
  active_at: number;

  displayNameInProfile?: string; // no matter the type of conversation, this is the real name as set by the user/name of the open or closed group
  nickname?: string; // this is the name WE gave to that user (only applicable to private chats, not closed group neither opengroups)

  profileKey?: string; // Consider this being a hex string if it is set

  members: Array<string>; // members are all members for this group. zombies excluded
  zombies: Array<string>; // only used for closed groups. Zombies are users which left but not yet removed by the admin
  left: boolean;
  expireTimer: number;
  mentionedUs: boolean;
  unreadCount: number;
  lastMessageStatus: LastMessageStatusType;

  /**
   * lastMessage is actually just a preview of the last message text, shortened to 60 chars.
   * This is to avoid filling the redux store with a huge last message when it's only used in the
   * preview of a conversation (leftpane).
   * The shortening is made in sql.ts directly.
   */
  lastMessage: string | null;
  lastJoinedTimestamp: number; // ClosedGroup: last time we were added to this group
  groupAdmins: Array<string>; // for sogs and closed group: the admins of that group.
  groupModerators: Array<string>; // for sogs only, this is the moderator in that room.
  isKickedFromGroup: boolean;

  is_medium_group: boolean;

  avatarPointer?: string; // this is the url of the avatar on the file server v2. we use this to detect if we need to redownload the avatar from someone (not used for opengroups)
  avatarInProfile?: string; // this is the avatar path locally once downloaded and stored in the application attachments folder
  avatarImageId?: number; //Avatar imageID is currently used only for opengroupv2. It's the fileID of the image uploaded and set as the sogs avatar

  triggerNotificationsFor: ConversationNotificationSettingType;
  isTrustedForAttachmentDownload: boolean;
  isPinned: boolean;
  isApproved: boolean;
  didApproveMe: boolean;

  /** The open group chat this conversation originated from (if from closed group) */
  conversationIdOrigin?: string;

  markedAsUnread: boolean;

  hidden: boolean;
}

/**
 * This function mutates optAttributes
 * @param optAttributes the entry object attributes to set the defaults to.
 *
 * Test are in ConversationModels_test.ts
 */
export const fillConvoAttributesWithDefaults = (
  optAttributes: ConversationAttributes
): ConversationAttributes => {
  return defaults(optAttributes, {
    members: [],
    zombies: [],
    groupAdmins: [],

    unreadCount: 0,
    lastJoinedTimestamp: 0,
    expireTimer: 0,
    active_at: 0,

    lastMessageStatus: undefined,
    lastMessage: null,

    triggerNotificationsFor: 'all', // if the settings is not set in the db, this is the default

    isTrustedForAttachmentDownload: false, // we don't trust a contact until we say so
    isPinned: false,
    isApproved: false,
    didApproveMe: false,
    is_medium_group: false,
    mentionedUs: false,
    isKickedFromGroup: false,
    left: false,
    hidden: true,
  });
};
