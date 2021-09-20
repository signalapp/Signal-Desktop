// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { RawMessage } from '../types/RawMessage';
import { SignalService } from '../../protobuf';
import { MessageEncrypter } from '../crypto';
import pRetry from 'p-retry';
import { PubKey } from '../types';
import { UserUtils } from '../utils';
import { OpenGroupRequestCommonType } from '../../opengroup/opengroupV2/ApiUtil';
import { postMessage } from '../../opengroup/opengroupV2/OpenGroupAPIV2';
import { OpenGroupMessageV2 } from '../../opengroup/opengroupV2/OpenGroupMessageV2';
import { fromUInt8ArrayToBase64 } from '../utils/String';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { addMessagePadding } from '../crypto/BufferPadding';
import _ from 'lodash';
import { storeOnNode } from '../snode_api/SNodeAPI';
import { getSwarmFor } from '../snode_api/snodePool';
import { firstTrue } from '../utils/Promise';
import { MessageSender } from '.';
import { getConversationById, getMessageById } from '../../../ts/data/data';
import { SNodeAPI } from '../snode_api';

const DEFAULT_CONNECTIONS = 3;

// ================ SNODE STORE ================

function overwriteOutgoingTimestampWithNetworkTimestamp(message: RawMessage) {
  const diffTimestamp = Date.now() - SNodeAPI.getLatestTimestampOffset();

  const { plainTextBuffer } = message;
  const contentDecoded = SignalService.Content.decode(plainTextBuffer);
  const { dataMessage, dataExtractionNotification, typingMessage } = contentDecoded;
  if (dataMessage && dataMessage.timestamp && dataMessage.timestamp > 0) {
    // this is a sync message, do not overwrite the message timestamp
    if (dataMessage.syncTarget) {
      return {
        overRiddenTimestampBuffer: plainTextBuffer,
        diffTimestamp: _.toNumber(dataMessage.timestamp),
      };
    }
    dataMessage.timestamp = diffTimestamp;
  }
  if (
    dataExtractionNotification &&
    dataExtractionNotification.timestamp &&
    dataExtractionNotification.timestamp > 0
  ) {
    dataExtractionNotification.timestamp = diffTimestamp;
  }
  if (typingMessage && typingMessage.timestamp && typingMessage.timestamp > 0) {
    typingMessage.timestamp = diffTimestamp;
  }
  const overRiddenTimestampBuffer = SignalService.Content.encode(contentDecoded).finish();
  return { overRiddenTimestampBuffer, diffTimestamp };
}

export function getMinRetryTimeout() {
  return 1000;
}

/**
 * Send a message via service nodes.
 *
 * @param message The message to send.
 * @param attempts The amount of times to attempt sending. Minimum value is 1.
 */
export async function send(
  message: RawMessage,
  attempts: number = 3,
  retryMinTimeout?: number, // in ms
  isSyncMessage?: boolean
): Promise<{ wrappedEnvelope: Uint8Array; effectiveTimestamp: number }> {
  return pRetry(
    async () => {
      const device = PubKey.cast(message.device);
      const { encryption, ttl } = message;

      const {
        overRiddenTimestampBuffer,
        diffTimestamp,
      } = overwriteOutgoingTimestampWithNetworkTimestamp(message);

      const { envelopeType, cipherText } = await MessageEncrypter.encrypt(
        device,
        overRiddenTimestampBuffer,
        encryption
      );

      const envelope = await buildEnvelope(envelopeType, device.key, diffTimestamp, cipherText);

      const data = wrapEnvelope(envelope);
      // make sure to update the local sent_at timestamp, because sometimes, we will get the just pushed message in the receiver side
      // before we return from the await below.
      // and the isDuplicate messages relies on sent_at timestamp to be valid.
      const found = await getMessageById(message.identifier);

      // make sure to not update the send timestamp if this a currently syncing message
      if (found && !found.get('sentSync')) {
        found.set({ sent_at: diffTimestamp });
        await found.commit();
      }
      await MessageSender.TEST_sendMessageToSnode(
        device.key,
        data,
        ttl,
        diffTimestamp,
        isSyncMessage,
        message.identifier
      );
      return { wrappedEnvelope: data, effectiveTimestamp: diffTimestamp };
    },
    {
      retries: Math.max(attempts - 1, 0),
      factor: 1,
      minTimeout: retryMinTimeout || MessageSender.getMinRetryTimeout(),
    }
  );
}

export async function TEST_sendMessageToSnode(
  pubKey: string,
  data: Uint8Array,
  ttl: number,
  timestamp: number,
  isSyncMessage?: boolean,
  messageId?: string
): Promise<void> {
  const data64 = window.dcodeIO.ByteBuffer.wrap(data).toString('base64');
  const swarm = await getSwarmFor(pubKey);

  window?.log?.debug('Sending envelope with timestamp: ', timestamp, ' to ', pubKey);
  // send parameters
  const params = {
    pubKey,
    ttl: `${ttl}`,
    timestamp: `${timestamp}`,
    data: data64,
    isSyncMessage,
    messageId,
  };

  const usedNodes = _.slice(swarm, 0, DEFAULT_CONNECTIONS);

  let successfulSendHash: any;
  const promises = usedNodes.map(async usedNode => {
    // TODO: Revert back to using snode address instead of IP
    // No pRetry here as if this is a bad path it will be handled and retried in lokiOnionFetch.
    // the only case we could care about a retry would be when the usedNode is not correct,
    // but considering we trigger this request with a few snode in //, this should be fine.
    const successfulSend = await storeOnNode(usedNode, params);
    if (successfulSend) {
      if (_.isString(successfulSend)) {
        successfulSendHash = successfulSend;
      }
      return usedNode;
    }
    // should we mark snode as bad if it can't store our message?
    return undefined;
  });

  let snode;
  try {
    const firstSuccessSnode = await firstTrue(promises);
    snode = firstSuccessSnode;
  } catch (e) {
    const snodeStr = snode ? `${snode.ip}:${snode.port}` : 'null';
    window?.log?.warn(
      `loki_message:::sendMessage - ${e.code} ${e.message} to ${pubKey} via snode:${snodeStr}`
    );
    throw e;
  }
  if (!usedNodes || usedNodes.length === 0) {
    throw new window.textsecure.EmptySwarmError(pubKey, 'Ran out of swarm nodes to query');
  }

  const conversation = await getConversationById(pubKey);
  const isClosedGroup = conversation?.isClosedGroup();

  // If message also has a sync message, save that hash. Otherwise save the hash from the regular message send i.e. only closed groups in this case.
  if (messageId && (isSyncMessage || isClosedGroup)) {
    const message = await getMessageById(messageId);
    if (message) {
      await message.updateMessageHash(successfulSendHash);
      await message.commit();
      window?.log?.info(
        `updated message ${message.get('id')} with hash: ${message.get('messageHash')}`
      );
    }
  }

  window?.log?.info(
    `loki_message:::sendMessage - Successfully stored message to ${pubKey} via ${snode.ip}:${snode.port}`
  );
}

async function buildEnvelope(
  type: SignalService.Envelope.Type,
  sskSource: string | undefined,
  timestamp: number,
  content: Uint8Array
): Promise<SignalService.Envelope> {
  let source: string | undefined;

  if (type === SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE) {
    source = sskSource;
  }

  return SignalService.Envelope.create({
    type,
    source,
    timestamp,
    content,
  });
}

/**
 * This is an outdated practice and we should probably just send the envelope data directly.
 * Something to think about in the future.
 */
function wrapEnvelope(envelope: SignalService.Envelope): Uint8Array {
  const request = SignalService.WebSocketRequestMessage.create({
    id: 0,
    body: SignalService.Envelope.encode(envelope).finish(),
    verb: 'PUT',
    path: '/api/v1/message',
  });

  const websocket = SignalService.WebSocketMessage.create({
    type: SignalService.WebSocketMessage.Type.REQUEST,
    request,
  });
  return SignalService.WebSocketMessage.encode(websocket).finish();
}

// ================ Open Group ================
/**
 * Send a message to an open group v2.
 * @param message The open group message.
 */
export async function sendToOpenGroupV2(
  rawMessage: OpenGroupVisibleMessage,
  roomInfos: OpenGroupRequestCommonType
): Promise<OpenGroupMessageV2> {
  // we agreed to pad message for opengroupv2
  const paddedBody = addMessagePadding(rawMessage.plainTextBuffer());
  const v2Message = new OpenGroupMessageV2({
    sentTimestamp: Date.now(),
    sender: UserUtils.getOurPubKeyStrFromCache(),
    base64EncodedData: fromUInt8ArrayToBase64(paddedBody),
    // the signature is added in the postMessage())
  });

  // Warning: postMessage throws
  const sentMessage = await postMessage(v2Message, roomInfos);
  return sentMessage;
}
