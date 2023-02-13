import { getSodiumRenderer } from '../../crypto';
import { StringUtils, UserUtils } from '../../utils';
import { fromHexToArray, fromUInt8ArrayToBase64 } from '../../utils/String';
import { GetNetworkTime } from './getNetworkTime';

export type SnodeSignatureResult = {
  timestamp: number;
  sig_timestamp: number;
  signature: string;
  pubkey_ed25519: string;
  pubkey: string; // this is the x25519 key of the pubkey we are doing the request to (ourself for our swarm usually)
};

async function getSnodeSignatureByHashesParams({
  messages,
  method,
  pubkey,
}: {
  pubkey: string;
  messages: Array<string>;
  method: 'delete';
}): Promise<
  Pick<SnodeSignatureResult, 'pubkey_ed25519' | 'signature' | 'pubkey'> & {
    messages: Array<string>;
  }
> {
  const ourEd25519Key = await UserUtils.getUserED25519KeyPair();

  if (!ourEd25519Key) {
    const err = `getSnodeSignatureParams "${method}": User has no getUserED25519KeyPair()`;
    window.log.warn(err);
    throw new Error(err);
  }
  const edKeyPrivBytes = fromHexToArray(ourEd25519Key?.privKey);
  const verificationData = StringUtils.encode(`${method}${messages.join('')}`, 'utf8');
  const message = new Uint8Array(verificationData);

  const sodium = await getSodiumRenderer();
  try {
    const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
    const signatureBase64 = fromUInt8ArrayToBase64(signature);

    return {
      signature: signatureBase64,
      pubkey_ed25519: ourEd25519Key.pubKey,
      pubkey,
      messages,
    };
  } catch (e) {
    window.log.warn('getSnodeSignatureParams failed with: ', e.message);
    throw e;
  }
}

async function getSnodeSignatureParams(params: {
  pubkey: string;
  namespace: number | null;
  method: 'retrieve' | 'store' | 'delete_all';
}): Promise<SnodeSignatureResult> {
  const ourEd25519Key = await UserUtils.getUserED25519KeyPair();

  if (!ourEd25519Key) {
    const err = `getSnodeSignatureParams "${params.method}": User has no getUserED25519KeyPair()`;
    window.log.warn(err);
    throw new Error(err);
  }
  const namespace = params.namespace || 0;
  const edKeyPrivBytes = fromHexToArray(ourEd25519Key?.privKey);

  const signatureTimestamp = GetNetworkTime.getNowWithNetworkOffset();

  const verificationData =
    namespace === 0
      ? StringUtils.encode(`${params.method}${signatureTimestamp}`, 'utf8')
      : StringUtils.encode(`${params.method}${namespace}${signatureTimestamp}`, 'utf8');

  const message = new Uint8Array(verificationData);

  const sodium = await getSodiumRenderer();
  try {
    const signature = sodium.crypto_sign_detached(message, edKeyPrivBytes);
    const signatureBase64 = fromUInt8ArrayToBase64(signature);

    return {
      sig_timestamp: signatureTimestamp,
      timestamp: signatureTimestamp,
      signature: signatureBase64,
      pubkey_ed25519: ourEd25519Key.pubKey,
      pubkey: params.pubkey,
    };
  } catch (e) {
    window.log.warn('getSnodeSignatureParams failed with: ', e.message);
    throw e;
  }
}

export const SnodeSignature = { getSnodeSignatureParams, getSnodeSignatureByHashesParams };
