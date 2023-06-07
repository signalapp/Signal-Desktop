import AbortController from 'abort-controller';
import { callUtilsWorker } from '../../../webworker/workers/browser/util_worker_interface';
import { OnionSending } from '../../onions/onionSend';

export const pnServerPubkeyHex = '642a6585919742e5a2d4dc51244964fbcd8bcab2b75612407de58b810740d049';
export const hrefPnServerProd = 'live.apns.getsession.org';
export const pnServerUrl = `https://${hrefPnServerProd}`;

export async function notifyPnServer(wrappedEnvelope: ArrayBuffer, sentTo: string) {
  const wrappedEnvelopeBase64 = await callUtilsWorker('arrayBufferToStringBase64', wrappedEnvelope);

  // we actually don't care about the result of this request, and it's better like this
  // as it is not a response encoded back for us with a symmetric key
  await OnionSending.sendJsonViaOnionV4ToPnServer({
    abortSignal: new AbortController().signal,
    endpoint: '/notify',
    method: 'POST',
    stringifiedBody: JSON.stringify({
      data: wrappedEnvelopeBase64,
      send_to: sentTo,
    }),
  });
}
