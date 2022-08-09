import { difference, omit, pick } from 'lodash';
import { ConversationAttributes } from '../models/conversationAttributes';

export function objectToJSON(data: Record<any, any>) {
  return JSON.stringify(data);
}
export function jsonToObject(json: string): Record<string, any> {
  return JSON.parse(json);
}

function jsonToArray(json: string): Array<string> {
  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn('jsontoarray failed:', e.message);
    return [];
  }
}

export function arrayStrToJson(arr: Array<string>): string {
  return JSON.stringify(arr);
}

export function toSqliteBoolean(val: boolean): number {
  return val ? 1 : 0;
}

// this is used to make sure when storing something in the database you remember to add the wrapping for it in formatRowOfConversation
const allowedKeysFormatRowOfConversation = [
  'groupAdmins',
  'groupModerators',
  'members',
  'zombies',
  'isTrustedForAttachmentDownload',
  'isPinned',
  'isApproved',
  'didApproveMe',
  'is_medium_group',
  'mentionedUs',
  'isKickedFromGroup',
  'left',
  'lastMessage',
  'lastMessageStatus',
  'triggerNotificationsFor',
  'unreadCount',
  'lastJoinedTimestamp',
  'subscriberCount',
  'readCapability',
  'writeCapability',
  'uploadCapability',
  'expireTimer',
  'active_at',
  'id',
  'type',
  'avatarPointer',
  'avatarImageId',
  'nickname',
  'profileKey',
  'avatarInProfile',
  'displayNameInProfile',
  'conversationIdOrigin',
];

export function formatRowOfConversation(row?: Record<string, any>): ConversationAttributes | null {
  if (!row) {
    return null;
  }

  const foundInRowButNotInAllowed = difference(
    Object.keys(row),
    allowedKeysFormatRowOfConversation
  );

  if (foundInRowButNotInAllowed?.length) {
    console.warn('formatRowOfConversation: foundInRowButNotInAllowed: ', foundInRowButNotInAllowed);

    throw new Error(
      `formatRowOfConversation: an invalid key was given in the record: ${foundInRowButNotInAllowed[0]}`
    );
  }

  const convo: ConversationAttributes = omit(row, 'json') as ConversationAttributes;

  // if the stringified array of admins/moderators/members/zombies length is less than 5,
  // we consider there is nothing to parse and just return []
  const minLengthNoParsing = 5;

  convo.groupAdmins =
    row.groupAdmins?.length && row.groupAdmins.length > minLengthNoParsing
      ? jsonToArray(row.groupAdmins)
      : [];
  convo.groupModerators =
    row.groupModerators?.length && row.groupModerators.length > minLengthNoParsing
      ? jsonToArray(row.groupModerators)
      : [];

  convo.members =
    row.members?.length && row.members.length > minLengthNoParsing ? jsonToArray(row.members) : [];
  convo.zombies =
    row.zombies?.length && row.zombies.length > minLengthNoParsing ? jsonToArray(row.zombies) : [];

  // sqlite stores boolean as integer. to clean thing up we force the expected boolean fields to be boolean
  convo.isTrustedForAttachmentDownload = Boolean(convo.isTrustedForAttachmentDownload);
  convo.isPinned = Boolean(convo.isPinned);
  convo.isApproved = Boolean(convo.isApproved);
  convo.didApproveMe = Boolean(convo.didApproveMe);
  convo.is_medium_group = Boolean(convo.is_medium_group);
  convo.mentionedUs = Boolean(convo.mentionedUs);
  convo.isKickedFromGroup = Boolean(convo.isKickedFromGroup);
  convo.left = Boolean(convo.left);
  convo.readCapability = Boolean(convo.readCapability);
  convo.writeCapability = Boolean(convo.writeCapability);
  convo.uploadCapability = Boolean(convo.uploadCapability);

  if (!convo.conversationIdOrigin) {
    convo.conversationIdOrigin = undefined;
  }

  if (!convo.lastMessage) {
    convo.lastMessage = null;
  }

  if (!convo.lastMessageStatus) {
    convo.lastMessageStatus = undefined;
  }

  if (!convo.triggerNotificationsFor) {
    convo.triggerNotificationsFor = 'all';
  }

  if (!convo.unreadCount) {
    convo.unreadCount = 0;
  }

  if (!convo.lastJoinedTimestamp) {
    convo.lastJoinedTimestamp = 0;
  }

  if (!convo.subscriberCount) {
    convo.subscriberCount = 0;
  }

  if (!convo.expireTimer) {
    convo.expireTimer = 0;
  }

  if (!convo.active_at) {
    convo.active_at = 0;
  }

  return convo;
}

const allowedKeysOfConversationAttributes = [
  'groupAdmins',
  'groupModerators',
  'members',
  'zombies',
  'isTrustedForAttachmentDownload',
  'isPinned',
  'isApproved',
  'didApproveMe',
  'is_medium_group',
  'mentionedUs',
  'isKickedFromGroup',
  'left',
  'lastMessage',
  'lastMessageStatus',
  'triggerNotificationsFor',
  'unreadCount',
  'lastJoinedTimestamp',
  'subscriberCount',
  'readCapability',
  'writeCapability',
  'uploadCapability',
  'expireTimer',
  'active_at',
  'id',
  'type',
  'avatarPointer',
  'avatarImageId',
  'nickname',
  'profileKey',
  'avatarInProfile',
  'displayNameInProfile',
  'conversationIdOrigin',
];

/**
 * assertValidConversationAttributes is used to make sure that only the keys stored in the database are sent from the renderer.
 * We could also add some type checking here to make sure what is sent by the renderer matches what we expect to store in the DB
 */
export function assertValidConversationAttributes(
  data: ConversationAttributes
): ConversationAttributes {
  // first make sure all keys of the object data are expected to be there
  const foundInAttributesButNotInAllowed = difference(
    Object.keys(data),
    allowedKeysOfConversationAttributes
  );

  if (foundInAttributesButNotInAllowed?.length) {
    // tslint:disable-next-line: no-console
    console.error(
      `assertValidConversationAttributes: an invalid key was given in the record: ${foundInAttributesButNotInAllowed}`
    );
    throw new Error(
      `assertValidConversationAttributes: found a not allowed key: ${foundInAttributesButNotInAllowed[0]}`
    );
  }

  return pick(data, allowedKeysOfConversationAttributes) as ConversationAttributes;
}
