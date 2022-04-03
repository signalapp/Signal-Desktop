import { isArrayBuffer } from 'lodash';
import { fromHexToArray } from '../session/utils/String';
// import { callUtilsWorker } from '../webworker/workers/util_worker_interface';
import { getItemById } from '../data/channelsItem';

export const encryptAttachmentBuffer = async (bufferIn: ArrayBuffer) => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const key = (await getItemById('local_attachment_encrypted_key'))?.value as string | undefined;
  if (!key) {
    throw new TypeError(
      "'encryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return callUtilsWorker('encryptAttachmentBuffer', encryptingKey, bufferIn);
};

export const decryptAttachmentBuffer = async (bufferIn: ArrayBuffer): Promise<Uint8Array> => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const key = (await getItemById('local_attachment_encrypted_key'))?.value as string;
  if (!key) {
    throw new TypeError(
      "'decryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return callUtilsWorker('decryptAttachmentBuffer', encryptingKey, bufferIn);
};
