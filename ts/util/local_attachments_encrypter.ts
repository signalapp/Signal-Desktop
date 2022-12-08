import { isArrayBuffer } from 'lodash';
import { fromHexToArray } from '../session/utils/String';
import { callUtilsWorker } from '../webworker/workers/browser/util_worker_interface';
import { Data } from '../data/data';

export const encryptAttachmentBufferRenderer = async (bufferIn: ArrayBuffer) => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const key = (await Data.getItemById('local_attachment_encrypted_key'))?.value as
    | string
    | undefined;
  if (!key) {
    throw new TypeError(
      "'encryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return callUtilsWorker('encryptAttachmentBufferNode', encryptingKey, bufferIn);
};

export const decryptAttachmentBufferRenderer = async (
  bufferIn: ArrayBuffer
): Promise<Uint8Array> => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const key = (await Data.getItemById('local_attachment_encrypted_key'))?.value as string;
  if (!key) {
    throw new TypeError(
      "'decryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return callUtilsWorker('decryptAttachmentBufferNode', encryptingKey, bufferIn);
};
