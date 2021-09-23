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
  switch (type) {
    case SignalService.CallMessage.Type.END_CALL:
      window.log.info('handling callMessage END_CALL');
      break;
    case SignalService.CallMessage.Type.ANSWER:
      window.log.info('handling callMessage ANSWER');
      break;
    case SignalService.CallMessage.Type.ICE_CANDIDATES:
      window.log.info('handling callMessage ICE_CANDIDATES');
      break;
    case SignalService.CallMessage.Type.OFFER:
      window.log.info('handling callMessage OFFER');
      break;
    case SignalService.CallMessage.Type.PROVISIONAL_ANSWER:
      window.log.info('handling callMessage PROVISIONAL_ANSWER');
      break;
    default:
      window.log.info('handling callMessage unknown');
  }
  if (type === SignalService.CallMessage.Type.OFFER) {
    if (Math.max(sentTimestamp - (Date.now() - currentOffset)) > TTL_DEFAULT.CALL_MESSAGE) {
      window?.log?.info('Dropping incoming OFFER callMessage sent a while ago: ', sentTimestamp);
      await removeFromCache(envelope);

      return;
    }
    await removeFromCache(envelope);

    CallManager.handleOfferCallMessage(sender, callMessage);

    return;
  }

  if (type === SignalService.CallMessage.Type.END_CALL) {
    await removeFromCache(envelope);

    CallManager.handleEndCallMessage(sender);

    return;
  }

  if (type === SignalService.CallMessage.Type.ANSWER) {
    await removeFromCache(envelope);

    await CallManager.handleCallAnsweredMessage(sender, callMessage);

    return;
  }
  if (type === SignalService.CallMessage.Type.ICE_CANDIDATES) {
    await removeFromCache(envelope);

    await CallManager.handleIceCandidatesMessage(sender, callMessage);

    return;
  }
  await removeFromCache(envelope);

  // if this another type of call message, just add it to the manager
  await CallManager.handleOtherCallMessage(sender, callMessage);
}
