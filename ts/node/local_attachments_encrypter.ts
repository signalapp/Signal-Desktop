import { isArrayBuffer } from 'lodash';
import { fromHexToArray } from '../session/utils/String';
import { sqlNode } from './sql';

export const encryptAttachmentBuffer = async (bufferIn: ArrayBuffer) => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const key = sqlNode.getItemById('local_attachment_encrypted_key')?.value as string | undefined;
  if (!key) {
    throw new TypeError(
      "'encryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return window.callWorker('encryptAttachmentBuffer', encryptingKey, bufferIn);
};

export const decryptAttachmentBuffer = async (bufferIn: ArrayBuffer): Promise<Uint8Array> => {
  if (!isArrayBuffer(bufferIn)) {
    throw new TypeError("'bufferIn' must be an array buffer");
  }
  const key = sqlNode.getItemById('local_attachment_encrypted_key')?.value as string;
  if (!key) {
    throw new TypeError(
      "'decryptAttachmentBuffer' needs a key set in local_attachment_encrypted_key"
    );
  }
  const encryptingKey = fromHexToArray(key);
  return window.callWorker('decryptAttachmentBuffer', encryptingKey, bufferIn);
};
