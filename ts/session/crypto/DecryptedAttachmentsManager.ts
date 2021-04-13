/**
 * This file handles attachments for us.
 * If the attachment filepath is an encrypted one. It will decrypt it, cache it, and return the blob url to it.
 * An interval is run from time to time to cleanup old blobs loaded and not needed anymore (based on last access timestamp).
 *
 *
 */

import toArrayBuffer from 'to-arraybuffer';
import * as fse from 'fs-extra';
import { decryptAttachmentBuffer } from '../../types/Attachment';
import { HOURS, MINUTES, SECONDS } from '../utils/Number';

// FIXME.
// add a way to clean those from time to time (like every hours?)
// add a way to remove the blob when the attachment file path is removed (message removed?)
// do not hardcode the password
// a few FIXME image/jpeg is hard coded
const urlToDecryptedBlobMap = new Map<
  string,
  { decrypted: string; lastAccessTimestamp: number }
>();

export const cleanUpOldDecryptedMedias = () => {
  const currentTimestamp = Date.now();
  let countCleaned = 0;
  let countKept = 0;
  window.log.info('Starting cleaning of medias blobs...');
  for (const iterator of urlToDecryptedBlobMap) {
    // if the last access is older than one hour, revoke the url and remove it.
    if (iterator[1].lastAccessTimestamp < currentTimestamp - HOURS * 1) {
      URL.revokeObjectURL(iterator[1].decrypted);
      urlToDecryptedBlobMap.delete(iterator[0]);
      countCleaned++;
    } else {
      countKept++;
    }
  }
  window.log.info(
    `Clean medias blobs: cleaned/kept: ${countCleaned}:${countKept}`
  );
};

export const getDecryptedMediaUrl = async (
  url: string,
  contentType: string
): Promise<string> => {
  if (!url) {
    return url;
  }
  if (url.startsWith('blob:')) {
    return url;
  } else if (
    window.Signal.Migrations.attachmentsPath &&
    url.startsWith(window.Signal.Migrations.attachmentsPath)
  ) {
    // this is a file encoded by session on our current attachments path.
    // we consider the file is encrypted.
    // if it's not, the hook caller has to fallback to setting the img src as an url to the file instead and load it
    if (urlToDecryptedBlobMap.has(url)) {
      // refresh the last access timestamp so we keep the one being currently in use
      const existingObjUrl = urlToDecryptedBlobMap.get(url)
        ?.decrypted as string;

      urlToDecryptedBlobMap.set(url, {
        decrypted: existingObjUrl,
        lastAccessTimestamp: Date.now(),
      });
      // typescript does not realize that the has above makes sure the get is not undefined

      return existingObjUrl;
    } else {
      const encryptedFileContent = await fse.readFile(url);
      const decryptedContent = await decryptAttachmentBuffer(
        toArrayBuffer(encryptedFileContent)
      );
      if (decryptedContent?.length) {
        const arrayBuffer = decryptedContent.buffer;
        const { makeObjectUrl } = window.Signal.Types.VisualAttachment;
        const obj = makeObjectUrl(arrayBuffer, contentType);

        if (!urlToDecryptedBlobMap.has(url)) {
          urlToDecryptedBlobMap.set(url, {
            decrypted: obj,
            lastAccessTimestamp: Date.now(),
          });
        }
        return obj;
      } else {
        // failed to decrypt, fallback to url image loading
        // it might be a media we received before the update encrypting attachments locally.
        return url;
      }
    }
  } else {
    // Not sure what we got here. Just return the file.

    return url;
  }
};
