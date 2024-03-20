import { defaults } from 'lodash';
import { DisappearingMessageConversationModeType } from '../session/disappearing_messages/types';
import { LastMessageStatusType } from '../state/ducks/conversations';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../interactions/conversationInteractions';

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
export type ConversationNotificationSettingType = (typeof ConversationNotificationSetting)[number];

/**
 * Some fields are retrieved from the database as a select, but should not be saved in a commit()
 * TODO (do we, and can we use this)
 */
export type ConversationAttributesNotSaved = {
  mentionedUs: boolean;
  unreadCount: number;
};

export type ConversationAttributesWithNotSavedOnes = ConversationAttributes &
  ConversationAttributesNotSaved;

export interface ConversationAttributes {
  id: string;
  type: ConversationTypeEnum.PRIVATE | ConversationTypeEnum.GROUPV3 | ConversationTypeEnum.GROUP;

  // 0 means inactive (undefined and null too but we try to get rid of them and only have 0 = inactive)
  active_at: number; // this field is the one used to sort conversations in the left pane from most recent

  /**
   * lastMessage is actually just a preview of the last message text, shortened to 60 chars.
   * This is to avoid filling the redux store with a huge last message when it's only used in the
   * preview of a conversation (leftpane).
   * The shortening is made in sql.ts directly.
   */
  lastMessage: string | null;
  lastMessageStatus: LastMessageStatusType;
  lastMessageInteractionType: ConversationInteractionType | null;
  lastMessageInteractionStatus: ConversationInteractionStatus | null;

  avatarImageId?: number; // avatar imageID is currently used only for sogs. It's the fileID of the image uploaded and set as the sogs avatar (not only sogs I think, but our profile too?)

  left: boolean; // LEGACY GROUPS ONLY: if we left the group (communities are removed right away so it not relevant to communities) // TODOLATER to remove after legacy closed group are dropped
  isKickedFromGroup: boolean; // LEGACY GROUPS ONLY: if we got kicked from the group (communities just stop polling and a message sent get rejected, so not relevant to communities) // TODOLATER to remove after legacy closed group are dropped

  avatarInProfile?: string; // this is the avatar path locally once downloaded and stored in the application attachments folder

  isTrustedForAttachmentDownload: boolean; // not synced accross devices, this field is used if we should auto download attachments from this conversation or not

  conversationIdOrigin?: string; // Blinded message requests ONLY: The community from which this conversation originated from

  // TODOLATER those two items are only used for legacy closed groups and will be removed when we get rid of the legacy closed groups support
  lastJoinedTimestamp: number; // ClosedGroup: last time we were added to this group // TODOLATER to remove after legacy closed group are dropped
  zombies: Array<string>; // only used for closed groups. Zombies are users which left but not yet removed by the admin // TODOLATER to remove after legacy closed group are dropped

  // ===========================================================================
  // All of the items below are duplicated one way or the other with libsession.
  // It would be nice to at some point be able to only rely on libsession dumps
  // for those so there is no need to keep them in sync, but just have them in the dumps.
  // Note: If we do remove them, we also need to add some logic to the wrappers. For instance, we can currently search by nickname or display name and that works through the DB.

  displayNameInProfile?: string; // no matter the type of conversation, this is the real name as set by the user/name of the open or closed group
  nickname?: string; // this is the name WE gave to that user (only applicable to private chats, not closed group neither opengroups)
  profileKey?: string; // Consider this being a hex string if it is set
  triggerNotificationsFor: ConversationNotificationSettingType;
  avatarPointer?: string; // this is the url of the avatar on the file server v2. we use this to detect if we need to redownload the avatar from someone (not used for opengroups)
  /** in seconds, 0 means no expiration */
  expireTimer: number;

  members: Array<string>; // groups only members are all members for this group. zombies excluded (not used for communities)
  groupAdmins: Array<string>; // for sogs and closed group: the unique admins of that group

  priority: number; // -1 = hidden (contact and NTS only), 0 = normal, 1 = pinned

  isApproved: boolean; // if we sent a message request or sent a message to this contact, we approve them. If isApproved & didApproveMe, a message request becomes a contact
  didApproveMe: boolean; // if our message request was approved already (or they've sent us a message request/message themselves). If isApproved & didApproveMe, a message request becomes a contact

  markedAsUnread: boolean; // Force the conversation as unread even if all the messages are read. Used to highlight a conversation the user wants to check again later, synced.

  blocksSogsMsgReqsTimestamp: number; // if the convo is blinded and the user has denied contact through sogs, this field be set to the user's latest message timestamp

  /** disappearing messages setting for this conversation */
  expirationMode: DisappearingMessageConversationModeType;
  // TODO legacy messages support will be removed in a future release
  // TODO we need to make a migration to remove this value from the db since the implementation is hacky
  /** to warn the user that the person he is talking to is using an old client which might cause issues */
  hasOutdatedClient?: string;
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

    lastJoinedTimestamp: 0,
    expirationMode: 'off',
    expireTimer: 0,

    active_at: 0,

    lastMessage: null,
    lastMessageStatus: undefined,
    lastMessageInteractionType: null,
    lastMessageInteractionStatus: null,

    triggerNotificationsFor: 'all', // if the settings is not set in the db, this is the default

    isTrustedForAttachmentDownload: false, // we don't trust a contact until we say so
    isApproved: false,
    didApproveMe: false,
    isKickedFromGroup: false,
    left: false,
    priority: CONVERSATION_PRIORITIES.default,
    markedAsUnread: false,
    blocksSogsMsgReqsTimestamp: 0,
  });
};

/**
 * Priorities have a weird behavior.
 * * 0 always means unpinned and not hidden.
 * * -1 always means hidden.
 * * anything over 0 means pinned with the higher priority the better. (No sorting currently implemented)
 *
 * When our local user pins a conversation we should use 1 as the priority.
 * When we get an update from the libsession util wrapper, we should trust the value and set it locally as is.
 * So if we get 100 as priority, we set the conversation priority to 100.
 * If we get -20 as priority we set it as is, even if our current client does not understand what that means.
 *
 */
export const CONVERSATION_PRIORITIES = {
  default: 0,
  hidden: -1,
  pinned: 1, // anything over 0 means pinned, but when our local users pins a conversation, we set the priority to 1
};

export const READ_MESSAGE_STATE = {
  unread: 1,
  read: 0,
} as const;
