// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { messageHasPaymentEvent } from '../messages/helpers';
import type { MessageAttributesType } from '../model-types';
import {
  hasErrors,
  isCallHistory,
  isChatSessionRefreshed,
  isConversationMerge,
  isDeliveryIssue,
  isEndSession,
  isExpirationTimerUpdate,
  isGiftBadge,
  isGroupUpdate,
  isGroupV2Change,
  isKeyChange,
  isPhoneNumberDiscovery,
  isProfileChange,
  isTapToView,
  isTitleTransitionNotification,
  isUniversalTimerNotification,
  isUnsupportedMessage,
  isVerifiedChange,
} from '../state/selectors/message';

export function isMessageEmpty(attributes: MessageAttributesType): boolean {
  // Core message types - we check for all four because they can each stand alone
  const hasBody = Boolean(attributes.body);
  const hasAttachment = (attributes.attachments || []).length > 0;
  const hasEmbeddedContact = (attributes.contact || []).length > 0;
  const isSticker = Boolean(attributes.sticker);

  // Rendered sync messages
  const isCallHistoryValue = isCallHistory(attributes);
  const isChatSessionRefreshedValue = isChatSessionRefreshed(attributes);
  const isDeliveryIssueValue = isDeliveryIssue(attributes);
  const isGiftBadgeValue = isGiftBadge(attributes);
  const isGroupUpdateValue = isGroupUpdate(attributes);
  const isGroupV2ChangeValue = isGroupV2Change(attributes);
  const isEndSessionValue = isEndSession(attributes);
  const isExpirationTimerUpdateValue = isExpirationTimerUpdate(attributes);
  const isVerifiedChangeValue = isVerifiedChange(attributes);

  // Placeholder messages
  const isUnsupportedMessageValue = isUnsupportedMessage(attributes);
  const isTapToViewValue = isTapToView(attributes);

  // Errors
  const hasErrorsValue = hasErrors(attributes);

  // Locally-generated notifications
  const isKeyChangeValue = isKeyChange(attributes);
  const isProfileChangeValue = isProfileChange(attributes);
  const isUniversalTimerNotificationValue =
    isUniversalTimerNotification(attributes);
  const isConversationMergeValue = isConversationMerge(attributes);
  const isPhoneNumberDiscoveryValue = isPhoneNumberDiscovery(attributes);
  const isTitleTransitionNotificationValue =
    isTitleTransitionNotification(attributes);

  const isPayment = messageHasPaymentEvent(attributes);

  // Note: not all of these message types go through message.handleDataMessage

  const hasSomethingToDisplay =
    // Core message types
    hasBody ||
    hasAttachment ||
    hasEmbeddedContact ||
    isSticker ||
    isPayment ||
    // Rendered sync messages
    isCallHistoryValue ||
    isChatSessionRefreshedValue ||
    isDeliveryIssueValue ||
    isGiftBadgeValue ||
    isGroupUpdateValue ||
    isGroupV2ChangeValue ||
    isEndSessionValue ||
    isExpirationTimerUpdateValue ||
    isVerifiedChangeValue ||
    // Placeholder messages
    isUnsupportedMessageValue ||
    isTapToViewValue ||
    // Errors
    hasErrorsValue ||
    // Locally-generated notifications
    isKeyChangeValue ||
    isProfileChangeValue ||
    isUniversalTimerNotificationValue ||
    isConversationMergeValue ||
    isPhoneNumberDiscoveryValue ||
    isTitleTransitionNotificationValue;

  return !hasSomethingToDisplay;
}
