// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { RawMessage } from '../types/RawMessage';
import { OpenGroupMessage } from '../messages/outgoing';
import { SignalService } from '../../protobuf';
import { MessageEncrypter } from '../crypto';
import pRetry from 'p-retry';
import { PubKey } from '../types';
import { UserUtils } from '../utils';
import { OpenGroupRequestCommonType } from '../../opengroup/opengroupV2/ApiUtil';
import { postMessage } from '../../opengroup/opengroupV2/OpenGroupAPIV2';
import { OpenGroupMessageV2 } from '../../opengroup/opengroupV2/OpenGroupMessageV2';
import { padPlainTextBuffer } from '../crypto/MessageEncrypter';
import { fromUInt8ArrayToBase64 } from '../utils/String';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import * as LokiMessageApi from './LokiMessageApi';

// ================ Regular ================

/**
 * Send a message via service nodes.
 *
 * @param message The message to send.
 * @param attempts The amount of times to attempt sending. Minimum value is 1.
 */
export async function send(
  message: RawMessage,
  attempts: number = 3,
  retryMinTimeout?: number // in ms
): Promise<Uint8Array> {
  const device = PubKey.cast(message.device);
  const { plainTextBuffer, encryption, timestamp, ttl } = message;
  const { envelopeType, cipherText } = await MessageEncrypter.encrypt(
    device,
    plainTextBuffer,
    encryption
  );
  const envelope = await buildEnvelope(envelopeType, device.key, timestamp, cipherText);
  window?.log?.debug('Sending envelope', envelope, ' to ', device.key);
  const data = wrapEnvelope(envelope);

  return pRetry(
    async () => {
      await LokiMessageApi.sendMessage(device.key, data, timestamp, ttl);
      return data;
    },
    {
      retries: Math.max(attempts - 1, 0),
      factor: 1,
      minTimeout: retryMinTimeout || 1000,
    }
  );
}

async function buildEnvelope(
  type: SignalService.Envelope.Type,
  sskSource: string | undefined,
  timestamp: number,
  content: Uint8Array
): Promise<SignalService.Envelope> {
  let source: string | undefined;

  if (type === SignalService.Envelope.Type.CLOSED_GROUP_CIPHERTEXT) {
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
 * Deprecated Send a message to an open group v2.
 * @param message The open group message.
 */
export async function sendToOpenGroup(
  message: OpenGroupMessage
): Promise<{ serverId: number; serverTimestamp: number }> {
  /*
    Note: Retrying wasn't added to this but it can be added in the future if needed.
    The only problem is that `channelAPI.sendMessage` returns true/false and doesn't throw any error so we can never be sure why sending failed.
    This should be fixed and we shouldn't rely on returning true/false, rather return nothing (success) or throw an error (failure)
  */
  const { group, quote, attachments, preview, body, timestamp } = message;
  const channelAPI = await window.lokiPublicChatAPI.findOrCreateChannel(
    group.server,
    group.channel,
    group.conversationId
  );

  if (!channelAPI) {
    return { serverId: -1, serverTimestamp: -1 };
  }

  // Returns -1 on fail or an id > 0 on success
  return channelAPI.sendMessage(
    {
      quote,
      attachments: attachments || [],
      preview: preview || [],
      body,
    },
    timestamp
  );
}

/**
 * Deprecated Send a message to an open group v2.
 * @param message The open group message.
 */
export async function sendToOpenGroupV2(
  rawMessage: OpenGroupVisibleMessage,
  roomInfos: OpenGroupRequestCommonType
): Promise<OpenGroupMessageV2> {
  const paddedBody = padPlainTextBuffer(rawMessage.plainTextBuffer());
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
