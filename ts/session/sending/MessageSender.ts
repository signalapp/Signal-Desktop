// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { RawMessage } from '../types/RawMessage';
import { OpenGroupMessage } from '../messages/outgoing';
import { SignalService } from '../../protobuf';
import { UserUtil } from '../../util';
import { MessageEncrypter } from '../crypto';
import pRetry from 'p-retry';
import { PubKey } from '../types';

// ================ Regular ================

/**
 * Check if we can send to service nodes.
 */
export function canSendToSnode(): boolean {
  // Seems like lokiMessageAPI is not always guaranteed to be initialized
  return Boolean(window.lokiMessageAPI);
}

/**
 * Send a message via service nodes.
 *
 * @param message The message to send.
 * @param attempts The amount of times to attempt sending. Minimum value is 1.
 */
export async function send(
  message: RawMessage,
  attempts: number = 3
): Promise<void> {
  if (!canSendToSnode()) {
    throw new Error('lokiMessageAPI is not initialized.');
  }

  const device = PubKey.cast(message.device);
  const { plainTextBuffer, encryption, timestamp, ttl } = message;
  const { envelopeType, cipherText } = await MessageEncrypter.encrypt(
    device,
    plainTextBuffer,
    encryption
  );
  const envelope = await buildEnvelope(envelopeType, timestamp, cipherText);
  const data = wrapEnvelope(envelope);

  return pRetry(
    async () =>
      window.lokiMessageAPI.sendMessage(device.key, data, timestamp, ttl),
    {
      retries: Math.max(attempts - 1, 0),
      factor: 1,
    }
  );
}

async function buildEnvelope(
  type: SignalService.Envelope.Type,
  timestamp: number,
  content: Uint8Array
): Promise<SignalService.Envelope> {
  let source: string | undefined;
  if (type !== SignalService.Envelope.Type.UNIDENTIFIED_SENDER) {
    source = await UserUtil.getCurrentDevicePubKey();
  }

  return SignalService.Envelope.create({
    type,
    source,
    sourceDevice: 1,
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
 * Send a message to an open group.
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
