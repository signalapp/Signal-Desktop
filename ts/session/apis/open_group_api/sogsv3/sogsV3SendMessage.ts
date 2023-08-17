import { AbortSignal } from 'abort-controller';
import { APPLICATION_JSON, APPLICATION_OCTET_STREAM } from '../../../../types/MIME';
import { OnionSending } from '../../../onions/onionSend';
import { UserUtils } from '../../../utils';
import { OpenGroupCapabilityRequest } from '../opengroupV2/ApiUtil';
import { OpenGroupMessageV2 } from '../opengroupV2/OpenGroupMessageV2';
import {
  OpenGroupPollingUtils,
  OpenGroupRequestHeaders,
} from '../opengroupV2/OpenGroupPollingUtils';
import { batchGlobalIsSuccess, parseBatchGlobalStatusCode } from './sogsV3BatchPoll';

export function addJsonContentTypeToHeaders(
  headers: OpenGroupRequestHeaders
): OpenGroupRequestHeaders {
  return { ...headers, 'Content-Type': APPLICATION_JSON };
}
export function addBinaryContentTypeToHeaders(
  headers: OpenGroupRequestHeaders
): OpenGroupRequestHeaders {
  return { ...headers, 'Content-Type': APPLICATION_OCTET_STREAM };
}

export type OpenGroupSendMessageRequest = OpenGroupCapabilityRequest & {
  blinded: boolean;
};

export const sendSogsMessageOnionV4 = async (
  serverUrl: string,
  room: string,
  abortSignal: AbortSignal,
  message: OpenGroupMessageV2,
  blinded: boolean
): Promise<OpenGroupMessageV2> => {
  const allValidRoomInfos = OpenGroupPollingUtils.getAllValidRoomInfos(serverUrl, new Set([room]));
  if (!allValidRoomInfos?.length) {
    window?.log?.info('getSendMessageRequest: no valid roominfos got.');
    throw new Error(`Could not find sogs pubkey of url:${serverUrl}`);
  }
  const endpoint = `/room/${room}/message`;
  const method = 'POST';
  const serverPubkey = allValidRoomInfos[0].serverPublicKey;
  const ourKeyPair = await UserUtils.getIdentityKeyPair();

  // if we are sending a blinded message, we have to sign it with the derived keypair
  // otherwise, we just sign it with our real keypair
  const signedMessage = blinded
    ? await message.signWithBlinding(serverPubkey)
    : await message.sign(ourKeyPair);
  const json = signedMessage.toJson();

  const stringifiedBody = JSON.stringify(json);

  const result = await OnionSending.sendJsonViaOnionV4ToSogs({
    serverUrl,
    endpoint,
    serverPubkey,
    method,
    abortSignal,
    blinded,
    stringifiedBody,
    headers: null,
    throwErrors: true,
  });

  if (!batchGlobalIsSuccess(result)) {
    window?.log?.warn('sendSogsMessageWithOnionV4 Got unknown status code; res:', result);
    throw new Error(
      `sendSogsMessageOnionV4: invalid status code: ${parseBatchGlobalStatusCode(result)}`
    );
  }

  if (!result) {
    throw new Error('Could not postMessage, res is invalid');
  }
  const rawMessage = result.body as Record<string, any>;
  if (!rawMessage) {
    throw new Error('postMessage parsing failed');
  }

  const toParse = {
    data: rawMessage.data,
    server_id: rawMessage.id,
    public_key: rawMessage.session_id,
    timestamp: Math.floor(rawMessage.posted * 1000),
    signature: rawMessage.signature,
  };

  // this will throw if the json is not valid
  const parsed = OpenGroupMessageV2.fromJson(toParse);
  return parsed;
};

export const sendMessageOnionV4BlindedRequest = async (
  serverUrl: string,
  room: string,
  abortSignal: AbortSignal,
  message: OpenGroupMessageV2,
  recipientBlindedId: string
): Promise<{ serverId: number; serverTimestamp: number }> => {
  const allValidRoomInfos = OpenGroupPollingUtils.getAllValidRoomInfos(serverUrl, new Set([room]));
  if (!allValidRoomInfos?.length) {
    window?.log?.info('getSendMessageRequest: no valid roominfos got.');
    throw new Error(`Could not find sogs pubkey of url:${serverUrl}`);
  }
  const endpoint = `/inbox/${recipientBlindedId}`;
  const method = 'POST';
  const serverPubkey = allValidRoomInfos[0].serverPublicKey;

  // if we are sending a blinded message, we have to sign it with the derived keypair
  // otherwise, we just sign it with our real keypair
  const signedMessage = await message.signWithBlinding(serverPubkey);
  const json = signedMessage.toBlindedMessageRequestJson();
  const stringifiedBody = JSON.stringify(json);

  const result = await OnionSending.sendJsonViaOnionV4ToSogs({
    serverUrl,
    endpoint,
    serverPubkey,
    method,
    abortSignal,
    blinded: true,
    stringifiedBody,
    headers: null,
    throwErrors: true,
  });

  if (!batchGlobalIsSuccess(result)) {
    window?.log?.warn('sendMessageOnionV4BlindedRequest Got unknown status code; res:', result);
    throw new Error(
      `sendMessageOnionV4BlindedRequest: invalid status code: ${parseBatchGlobalStatusCode(result)}`
    );
  }

  if (!result) {
    throw new Error('Could not postMessage, res is invalid');
  }
  const rawMessage = result.body as Record<string, any>;
  if (!rawMessage) {
    throw new Error('postMessage parsing failed');
  }

  const serverId = rawMessage.id as number | undefined;
  const serverTimestamp = rawMessage.posted_at as number | undefined;
  if (!serverTimestamp || serverId === undefined) {
    window.log.warn('Could not blinded message request, server returned invalid data:', rawMessage);
    throw new Error('Could not blinded message request, server returned invalid data');
  }

  return { serverId, serverTimestamp: Math.floor(serverTimestamp * 1000) }; // timestamp are now returned with a seconds.ms syntax
};
