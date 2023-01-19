// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { RawMessage } from '../types/RawMessage';
import { SignalService } from '../../protobuf';
import { MessageEncrypter } from '../crypto';
import pRetry from 'p-retry';
import { PubKey } from '../types';
import { OpenGroupRequestCommonType } from '../apis/open_group_api/opengroupV2/ApiUtil';
import { OpenGroupMessageV2 } from '../apis/open_group_api/opengroupV2/OpenGroupMessageV2';
import { fromUInt8ArrayToBase64 } from '../utils/String';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { addMessagePadding } from '../crypto/BufferPadding';
import _ from 'lodash';
import { getSwarmFor } from '../apis/snode_api/snodePool';
import { MessageSender } from '.';
import { Data, Snode } from '../../../ts/data/data';
import { getConversationController } from '../conversations';
import { ed25519Str } from '../onions/onionPath';
import { EmptySwarmError } from '../utils/errors';
import ByteBuffer from 'bytebuffer';
import {
  sendMessageOnionV4BlindedRequest,
  sendSogsMessageOnionV4,
} from '../apis/open_group_api/sogsv3/sogsV3SendMessage';
import { AbortController } from 'abort-controller';
import { SnodeAPIStore } from '../apis/snode_api/storeMessage';
import { StoreOnNodeParams } from '../apis/snode_api/SnodeRequestTypes';
import { GetNetworkTime } from '../apis/snode_api/getNetworkTime';
import { SnodeNamespace, SnodeNamespaces } from '../apis/snode_api/namespaces';
import { SnodeSignature, SnodeSignatureResult } from '../apis/snode_api/snodeSignatures';
import { UserUtils } from '../utils';

// ================ SNODE STORE ================

function overwriteOutgoingTimestampWithNetworkTimestamp(message: RawMessage) {
  const networkTimestamp = GetNetworkTime.getNowWithNetworkOffset();

  const { plainTextBuffer } = message;
  const contentDecoded = SignalService.Content.decode(plainTextBuffer);

  const { dataMessage, dataExtractionNotification, typingMessage } = contentDecoded;
  if (dataMessage && dataMessage.timestamp && dataMessage.timestamp > 0) {
    // this is a sync message, do not overwrite the message timestamp
    if (dataMessage.syncTarget) {
      return {
        overRiddenTimestampBuffer: plainTextBuffer,
        networkTimestamp: _.toNumber(dataMessage.timestamp),
      };
    }
    dataMessage.timestamp = networkTimestamp;
  }
  if (
    dataExtractionNotification &&
    dataExtractionNotification.timestamp &&
    dataExtractionNotification.timestamp > 0
  ) {
    dataExtractionNotification.timestamp = networkTimestamp;
  }
  if (typingMessage && typingMessage.timestamp && typingMessage.timestamp > 0) {
    typingMessage.timestamp = networkTimestamp;
  }
  const overRiddenTimestampBuffer = SignalService.Content.encode(contentDecoded).finish();
  return { overRiddenTimestampBuffer, networkTimestamp };
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
      const recipient = PubKey.cast(message.device);
      const { encryption, ttl } = message;
      let namespace = message.namespace;

      const {
        overRiddenTimestampBuffer,
        networkTimestamp,
      } = overwriteOutgoingTimestampWithNetworkTimestamp(message);

      const { envelopeType, cipherText } = await MessageEncrypter.encrypt(
        recipient,
        overRiddenTimestampBuffer,
        encryption
      );

      const envelope = await buildEnvelope(
        envelopeType,
        recipient.key,
        networkTimestamp,
        cipherText
      );

      const data = wrapEnvelope(envelope);
      // make sure to update the local sent_at timestamp, because sometimes, we will get the just pushed message in the receiver side
      // before we return from the await below.
      // and the isDuplicate messages relies on sent_at timestamp to be valid.
      const found = await Data.getMessageById(message.identifier);

      // make sure to not update the sent timestamp if this a currently syncing message
      if (found && !found.get('sentSync')) {
        found.set({ sent_at: networkTimestamp });
        await found.commit();
      }

      // right when we upgrade from not having namespaces stored in the outgoing cached messages our messages won't have a namespace associated.
      // So we need to keep doing the lookup of where they should go if the namespace is not set.
      if (namespace === null || namespace === undefined) {
        namespace = getConversationController()
          .get(recipient.key)
          ?.isClosedGroup()
          ? SnodeNamespaces.ClosedGroupMessage
          : SnodeNamespaces.UserMessages;
      }
      let timestamp = networkTimestamp;
      // the user config namespaces requires a signature to be added
      let signOpts: SnodeSignatureResult | undefined;
      if (SnodeNamespace.isUserConfigNamespace(namespace)) {
        signOpts = await SnodeSignature.getSnodeSignatureParams({
          method: 'store' as 'store',
          namespace,
          ourPubkey: UserUtils.getOurPubKeyStrFromCache(),
          pubkey: recipient.key,
        });
      }
      await MessageSender.sendMessageToSnode({
        pubKey: recipient.key,
        data,
        ttl,
        timestamp,
        isSyncMessage,
        messageId: message.identifier,
        namespace,
        ...signOpts,
      });
      return { wrappedEnvelope: data, effectiveTimestamp: networkTimestamp };
    },
    {
      retries: Math.max(attempts - 1, 0),
      factor: 1,
      minTimeout: retryMinTimeout || MessageSender.getMinRetryTimeout(),
    }
  );
}

export type SendMessageSignatureOpts = {
  signature?: string; // needed for some namespaces
  namespace: SnodeNamespaces;
  pubkey_ed25519?: string;
  timestamp: number;
};

// tslint:disable-next-line: function-name
export async function sendMessageToSnode({
  data,
  namespace,
  pubKey,
  timestamp,
  ttl,
  isSyncMessage,
  signature,
  messageId,
  pubkey_ed25519,
}: {
  pubKey: string;
  data: Uint8Array;
  ttl: number;
  namespace: SnodeNamespaces;
  isSyncMessage?: boolean;
  messageId?: string;
} & SendMessageSignatureOpts): Promise<void> {
  const data64 = ByteBuffer.wrap(data).toString('base64');
  const swarm = await getSwarmFor(pubKey);

  const conversation = getConversationController().get(pubKey);
  const isClosedGroup = conversation?.isClosedGroup();

  // send parameters
  const params: StoreOnNodeParams = {
    pubkey: pubKey,
    ttl: `${ttl}`,
    timestamp: `${timestamp}`,
    data: data64,
    namespace,
  };

  if (signature && pubkey_ed25519) {
    params.signature = signature;
    params.pubkey_ed25519 = pubkey_ed25519;
  }

  const usedNodes = _.slice(swarm, 0, 1);
  if (!usedNodes || usedNodes.length === 0) {
    throw new EmptySwarmError(pubKey, 'Ran out of swarm nodes to query');
  }

  let successfulSendHash: string | undefined;

  let snode: Snode | undefined;
  const snodeTried = usedNodes[0];

  try {
    // No pRetry here as if this is a bad path it will be handled and retried in lokiOnionFetch.
    // the only case we could care about a retry would be when the usedNode is not correct,
    // but considering we trigger this request with a few snode in //, this should be fine.
    const successfulSend = await SnodeAPIStore.storeOnNode(snodeTried, params);

    if (successfulSend) {
      if (_.isString(successfulSend)) {
        successfulSendHash = successfulSend;
      }
      snode = snodeTried;
    }
  } catch (e) {
    const snodeStr = snodeTried ? `${snodeTried.ip}:${snodeTried.port}` : 'null';
    window?.log?.warn(
      `loki_message:::sendMessage - "${e.code}:${e.message}" to ${pubKey} via snode:${snodeStr}`
    );
    throw e;
  }

  // If message also has a sync message, save that hash. Otherwise save the hash from the regular message send i.e. only closed groups in this case.
  if (messageId && (isSyncMessage || isClosedGroup) && successfulSendHash) {
    const message = await Data.getMessageById(messageId);
    if (message) {
      await message.updateMessageHash(successfulSendHash);
      await message.commit();
      window?.log?.info(
        `updated message ${message.get('id')} with hash: ${message.get('messageHash')}`
      );
    }
  }

  if (snode) {
    window?.log?.info(
      `loki_message:::sendMessage - Successfully stored message to ${ed25519Str(pubKey)} via ${
        snode.ip
      }:${snode.port}`
    );
  }
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
  roomInfos: OpenGroupRequestCommonType,
  blinded: boolean,
  filesToLink: Array<number>
): Promise<OpenGroupMessageV2 | boolean> {
  // we agreed to pad message for opengroupv2
  const paddedBody = addMessagePadding(rawMessage.plainTextBuffer());
  const v2Message = new OpenGroupMessageV2({
    sentTimestamp: GetNetworkTime.getNowWithNetworkOffset(),
    base64EncodedData: fromUInt8ArrayToBase64(paddedBody),
    filesToLink,
  });

  const msg = await sendSogsMessageOnionV4(
    roomInfos.serverUrl,
    roomInfos.roomId,
    new AbortController().signal,
    v2Message,
    blinded
  );
  return msg;
}

/**
 * Send a message to an open group v2.
 * @param message The open group message.
 */
export async function sendToOpenGroupV2BlindedRequest(
  encryptedContent: Uint8Array,
  roomInfos: OpenGroupRequestCommonType,
  recipientBlindedId: string
): Promise<{ serverId: number; serverTimestamp: number }> {
  const v2Message = new OpenGroupMessageV2({
    sentTimestamp: GetNetworkTime.getNowWithNetworkOffset(),
    base64EncodedData: fromUInt8ArrayToBase64(encryptedContent),
  });

  // Warning: sendMessageOnionV4BlindedRequest throws
  const msg = await sendMessageOnionV4BlindedRequest(
    roomInfos.serverUrl,
    roomInfos.roomId,
    new AbortController().signal,
    v2Message,
    recipientBlindedId
  );
  return msg;
}
