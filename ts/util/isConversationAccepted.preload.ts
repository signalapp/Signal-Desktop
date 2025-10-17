// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationAttributesType } from '../model-types.d.ts';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { isDirectConversation, isMe } from './whatTypeOfConversation.dom.js';
import { isInSystemContacts } from './isInSystemContacts.std.js';
import { createLogger } from '../logging/log.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

export type IsConversationAcceptedOptionsType = {
  ignoreEmptyConvo: boolean;
};

const log = createLogger('isConversationAccepted');

/**
 * Determine if this conversation should be considered "accepted" in terms
 * of message requests
 */
export function isConversationAccepted(
  conversationAttrs: ConversationAttributesType,
  { ignoreEmptyConvo }: IsConversationAcceptedOptionsType = {
    ignoreEmptyConvo: false,
  }
): boolean {
  if (isMe(conversationAttrs)) {
    return true;
  }

  const messageRequestEnum = Proto.SyncMessage.MessageRequestResponse.Type;

  const { messageRequestResponseType, removalStage } = conversationAttrs;
  if (removalStage !== undefined) {
    return false;
  }

  if (messageRequestResponseType === messageRequestEnum.ACCEPT) {
    return true;
  }

  const {
    sentMessageCount,
    messageCount,
    messageCountBeforeMessageRequests,
    pendingAdminApprovalV2,
    profileSharing,
  } = conversationAttrs;

  const ourAci = itemStorage.user.getAci();
  const hasRequestedToJoin =
    Boolean(ourAci) &&
    (pendingAdminApprovalV2 || []).some(item => item.aci === ourAci);
  if (hasRequestedToJoin) {
    return true;
  }

  const hasSentMessages = (sentMessageCount || 0) > 0;
  const hasMessagesBeforeMessageRequests =
    (messageCountBeforeMessageRequests || 0) > 0;
  const hasNoMessages = (messageCount || 0) === 0;

  // We don't want to show the message request UI in an empty conversation.
  const isEmptyPrivateConvo =
    hasNoMessages &&
    isDirectConversation(conversationAttrs) &&
    !ignoreEmptyConvo;
  const isEmptyWhitelistedGroup =
    hasNoMessages &&
    !isDirectConversation(conversationAttrs) &&
    Boolean(profileSharing);

  return (
    isFromOrAddedByTrustedContact(conversationAttrs) ||
    hasSentMessages ||
    hasMessagesBeforeMessageRequests ||
    // an empty group is the scenario where we need to rely on
    // whether the profile has already been shared or not
    isEmptyPrivateConvo ||
    isEmptyWhitelistedGroup
  );
}

// Is this someone me, a system contact, or are we sharing our profile with them?
export function isTrustedContact(
  conversationAttrs: ConversationAttributesType
): boolean {
  if (!isDirectConversation(conversationAttrs)) {
    log.error('isTrustedContact should only be called for direct convos');
    return false;
  }

  return (
    isMe(conversationAttrs) ||
    isInSystemContacts(conversationAttrs) ||
    Boolean(conversationAttrs.profileSharing)
  );
}

// Is this person (or the person who added us to this group) a trusted contact?
function isFromOrAddedByTrustedContact(
  conversationAttrs: ConversationAttributesType
): boolean {
  if (isDirectConversation(conversationAttrs)) {
    return isTrustedContact(conversationAttrs);
  }

  const { addedBy } = conversationAttrs;
  if (!addedBy) {
    return false;
  }

  const addedByContact = window.ConversationController.get(addedBy);
  if (!addedByContact) {
    return false;
  }

  return isTrustedContact(addedByContact.attributes);
}
