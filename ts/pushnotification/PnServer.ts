import { serverRequest } from '../session/onions/onionSend';
import { fromArrayBufferToBase64 } from '../session/utils/String';

const pnServerPubkeyHex = '642a6585919742e5a2d4dc51244964fbcd8bcab2b75612407de58b810740d049';

export const hrefPnServerProd = 'live.apns.getsession.org';
export const hrefPnServerDev = 'dev.apns.getsession.org';
const pnServerUrl = `https://${hrefPnServerProd}`;

export async function notify(plainTextBuffer: ArrayBuffer, sentTo: string) {
  const options = {
    method: 'post',
    objBody: {
      data: fromArrayBufferToBase64(plainTextBuffer),
      send_to: sentTo,
    },
  };
  const endpoint = 'notify';
  return serverRequest(`${pnServerUrl}/${endpoint}`, {
    ...options,
    srvPubKey: pnServerPubkeyHex,
  });
}
