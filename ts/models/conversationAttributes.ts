import { defaults } from 'lodash';
import { LastMessageStatusType } from '../state/ducks/conversations';
import { DisappearingMessageConversationType } from '../util/expiringMessages';

export enum ConversationTypeEnum {
  GROUP = 'group',
  PRIVATE = 'private',
}

/**
 * all: all  notifications enabled, the default
 * disabled: no notifications at all
 * mentions_only: trigger a notification only on mentions of ourself
 */
export const ConversationNotificationSetting = ['all', 'disabled', 'mentions_only'] as const;
export type ConversationNotificationSettingType = typeof ConversationNotificationSetting[number];

export interface ConversationAttributes {
  id: string;
  type: string;

  // 0 means inactive (undefined and null too but we try to get rid of them and only have 0 = inactive)
  active_at: number;

  displayNameInProfile?: string; // no matter the type of conversation, this is the real name as set by the user/name of the open or closed group
  nickname?: string; // this is the name WE gave to that user (only applicable to private chats, not closed group neither opengroups)

  profileKey?: string; // Consider this being a hex string if it is set

  members: Array<string>; // members are all members for this group. zombies excluded
  zombies: Array<string>; // only used for closed groups. Zombies are users which left but not yet removed by the admin
  left: boolean;

  expirationType: DisappearingMessageConversationType;
  expireTimer: number;
  lastDisappearingMessageChangeTimestamp: number;

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

  subscriberCount: number;
  readCapability: boolean;
  writeCapability: boolean;
  uploadCapability: boolean;

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
    subscriberCount: 0,
    expirationType: 'off',
    expireTimer: 0,
    lastDisappearingMessageChangeTimestamp: 0,
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
  });
};
