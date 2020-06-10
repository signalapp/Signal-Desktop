// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { RawMessage } from '../types/RawMessage';
import { OpenGroupMessage } from '../messages/outgoing';
import { SignalService } from '../../protobuf';
import { UserUtil } from '../../util';
import { MessageEncrypter } from '../crypto';
import { lokiMessageAPI, lokiPublicChatAPI } from '../../window';
import pRetry from 'p-retry';

// ================ Regular ================

/**
 * Check if we can send to service nodes.
 */
export function canSendToSnode(): boolean {
  // Seems like lokiMessageAPI is not always guaranteed to be initialized
  return Boolean(lokiMessageAPI);
}

/**
 * Send a message via service nodes.
 * @param message The message to send.
 * @param retries The amount of times to retry sending.
 */
export async function send(
  { device, plainTextBuffer, encryption, timestamp, ttl }: RawMessage,
  retries: number = 3
): Promise<void> {
  if (!canSendToSnode()) {
    throw new Error('lokiMessageAPI is not initialized.');
  }

  const { envelopeType, cipherText } = await MessageEncrypter.encrypt(
    device,
    plainTextBuffer,
    encryption
  );
  const envelope = await buildEnvelope(envelopeType, timestamp, cipherText);
  const data = wrapEnvelope(envelope);

  // pRetry counts retries after making the first call.
  // So a retry count of 3 means you make a request then if it fails you make another request 3 times until it succeeds.
  // This means a total of 4 requests are being sent, where as for us when we want 3 retries we only want 3 requests sent.
  return pRetry(
    async () => lokiMessageAPI.sendMessage(device, data, timestamp, ttl),
    {
      retries: retries - 1,
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
): Promise<boolean> {
  /*
    Note: Retrying wasn't added to this but it can be added in the future if needed.
    The only problem is that `channelAPI.sendMessage` returns true/false and doesn't throw any error so we can never be sure why sending failed.
    This should be fixed and we shouldn't rely on returning true/false, rather return nothing (success) or throw an error (failure)
  */
  const { group, quote, attachments, preview, body } = message;
  const channelAPI = await lokiPublicChatAPI.findOrCreateChannel(
    group.server,
    group.channel,
    group.conversationId
  );

  // Don't think returning true/false on `sendMessage` is a good way
  return channelAPI.sendMessage({
    quote,
    attachments: attachments || [],
    preview,
    body,
  });

  // TODO: The below should be handled in whichever class calls this
  /*
    const res = await sendToOpenGroup(message);
    if (!res) {
      throw new textsecure.PublicChatError('Failed to send public chat message');
    }
    const messageEventData = {
      pubKey,
      timestamp: messageTimeStamp,
    };
    messageEventData.serverId = res;
    window.Whisper.events.trigger('publicMessageSent', messageEventData);
  */
}
