// TODO legacy messages support will be removed in a future release
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

function contentHasTimerProp(contentMessage: SignalService.Content) {
  return ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationTimer');
}
function contentHasTypeProp(contentMessage: SignalService.Content) {
  return ProtobufUtils.hasDefinedProperty(contentMessage, 'expirationType');
}

/** Use this to check for legacy disappearing messages where the expirationType and expireTimer should be undefined on the ContentMessage */
export function couldBeLegacyDisappearingMessageContent(
  contentMessage: SignalService.Content
): boolean {
  const couldBe =
    (contentMessage.expirationType === SignalService.Content.ExpirationType.UNKNOWN ||
      ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()) &&
    !contentHasTypeProp(contentMessage) &&
    !contentHasTimerProp(contentMessage);

  return couldBe;
}
