// TODO legacy messages support will be removed in a future release
import { ConversationModel } from '../../models/conversation';
import { ProtobufUtils, SignalService } from '../../protobuf';
import { ReleasedFeatures } from '../../util/releaseFeature';
import { DisappearingMessageConversationModeType } from './types';

export function isLegacyDisappearingModeEnabled(
  expirationMode: DisappearingMessageConversationModeType | undefined
): boolean {
  return Boolean(
    expirationMode &&
      expirationMode !== 'off' &&
      !ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()
  );
}

export function checkIsLegacyDisappearingDataMessage(
  couldBeLegacyContent: boolean,
  dataMessage: SignalService.DataMessage
): boolean {
  return (
    couldBeLegacyContent &&
    ProtobufUtils.hasDefinedProperty(dataMessage, 'expireTimer') &&
    dataMessage.expireTimer > -1
  );
}

/** Use this to check for legacy disappearing messages where the expirationType and expireTimer should be undefined on the ContentMessage */
export function couldBeLegacyDisappearingMessageContent(
  contentMessage: SignalService.Content
): boolean {
  return (
    (contentMessage.expirationType === SignalService.Content.ExpirationType.UNKNOWN ||
      (ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached() &&
        !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationType'))) &&
    !ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationTimer')
  );
}

/**
 * Checks if a message is meant to disappear but doesn't have the correct expiration values set.
 *
 * Hopefully we can remove this when we remove legacy support but will need thorough testing
 *
 * NOTE Examples: legacy disappearing message conversation settings, synced messages from legacy devices
 */
export function checkShouldDisappearButIsntMessage(
  content: SignalService.Content,
  convo: ConversationModel,
  expirationMode: DisappearingMessageConversationModeType,
  expirationTimer: number
): boolean {
  return (
    content.dataMessage?.flags !== SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE &&
    expirationMode === 'off' &&
    expirationTimer === 0 &&
    convo.getExpirationMode() !== 'off' &&
    convo.getExpireTimer() !== 0
  );
}
