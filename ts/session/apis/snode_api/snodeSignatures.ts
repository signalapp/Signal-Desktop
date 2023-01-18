import { to_string } from 'libsodium-wrappers-sumo';
import { getSodiumRenderer } from '../../crypto';
import { UserUtils, StringUtils } from '../../utils';
import { fromHexToArray, fromUInt8ArrayToBase64 } from '../../utils/String';
import { GetNetworkTime } from './getNetworkTime';

export type SnodeSignatureResult = {
  timestamp: number;
  signature: string;
  pubkey_ed25519: string;
  namespace: number;
};

async function getSnodeSignatureParams(params: {
  pubkey: string;
  namespace: number;
  ourPubkey: string;
  method: 'retrieve' | 'store';
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
    console.warn(
      `signing: "${to_string(new Uint8Array(verificationData))}" signature:"${signatureBase64}"`
    );

    return {
      timestamp: signatureTimestamp,
      signature: signatureBase64,
      pubkey_ed25519: ourEd25519Key.pubKey,
      namespace,
    };
  } catch (e) {
    window.log.warn('getSnodeSignatureParams failed with: ', e.message);
    throw e;
  }
}

export const SnodeSignature = { getSnodeSignatureParams };
