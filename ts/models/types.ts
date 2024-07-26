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
