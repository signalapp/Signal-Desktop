// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { RawMessage } from '../types/RawMessage';
import { OpenGroupMessage } from '../messages/outgoing';
import { SignalService } from '../../protobuf';
import { UserUtil } from '../../util';
import { MessageEncrypter } from '../crypto';
import { lokiMessageAPI, lokiPublicChatAPI } from '../../window';
import pRetry from 'p-retry';

// ================ Regular ================

export function canSendToSnode(): boolean {
  // Seems like lokiMessageAPI is not always guaranteed to be initialized
  return Boolean(lokiMessageAPI);
}

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

  // pRetry doesn't count the first call as a retry
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

export async function sendToOpenGroup(
  message: OpenGroupMessage
): Promise<boolean> {
  const { group, quote, attachments, preview, body } = message;
  const channelAPI = await lokiPublicChatAPI.findOrCreateChannel(
    group.server,
    group.channel,
    group.conversationId
  );

  // Don't think returning true/false on `sendMessage` is a good way
  // We should either: return nothing (success) or throw an error (failure)
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
