import _ from 'lodash';
import { SignalService } from '../protobuf';
import { TTL_DEFAULT } from '../session/constants';
import { SNodeAPI } from '../session/snode_api';
import { CallManager } from '../session/utils';
import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';

// audric FIXME: refactor this out to persistence, just to help debug the flow and send/receive in synchronous testing

export async function handleCallMessage(
  envelope: EnvelopePlus,
  callMessage: SignalService.CallMessage
) {
  const sender = envelope.senderIdentity || envelope.source;

  const currentOffset = SNodeAPI.getLatestTimestampOffset();
  const sentTimestamp = _.toNumber(envelope.timestamp);

  const { type } = callMessage;

  if (type === SignalService.CallMessage.Type.PROVISIONAL_ANSWER) {
    await removeFromCache(envelope);

    window.log.info('Skipping callMessage PROVISIONAL_ANSWER');
    return;
  }

  if (type === SignalService.CallMessage.Type.PRE_OFFER) {
    await removeFromCache(envelope);

    window.log.info('Skipping callMessage PRE_OFFER');
    return;
  }

  if (type === SignalService.CallMessage.Type.OFFER) {
    if (Math.max(sentTimestamp - (Date.now() - currentOffset)) > TTL_DEFAULT.CALL_MESSAGE) {
      window?.log?.info('Dropping incoming OFFER callMessage sent a while ago: ', sentTimestamp);
      await removeFromCache(envelope);

      return;
    }
    await removeFromCache(envelope);

    await CallManager.handleCallTypeOffer(sender, callMessage, sentTimestamp);

    return;
  }

  if (type === SignalService.CallMessage.Type.END_CALL) {
    await removeFromCache(envelope);

    CallManager.handleCallTypeEndCall(sender, callMessage.uuid);

    return;
  }

  if (type === SignalService.CallMessage.Type.ANSWER) {
    await removeFromCache(envelope);

    await CallManager.handleCallTypeAnswer(sender, callMessage);

    return;
  }
  if (type === SignalService.CallMessage.Type.ICE_CANDIDATES) {
    await removeFromCache(envelope);

    await CallManager.handleCallTypeIceCandidates(sender, callMessage);

    return;
  }
  await removeFromCache(envelope);

  // if this another type of call message, just add it to the manager
  await CallManager.handleOtherCallTypes(sender, callMessage);
}
