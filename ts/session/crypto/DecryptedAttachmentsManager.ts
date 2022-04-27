/**
 * This file handles attachments for us.
 * If the attachment filepath is an encrypted one. It will decrypt it, cache it, and return the blob url to it.
 * An interval is run from time to time to cleanup old blobs loaded and not needed anymore (based on last access timestamp).
 *
 *
 */

import * as fse from 'fs-extra';
import { DURATION } from '../constants';
import { makeObjectUrl, urlToBlob } from '../../types/attachments/VisualAttachment';
import { getAttachmentPath } from '../../types/MessageAttachment';
import { decryptAttachmentBufferRenderer } from '../../util/local_attachments_encrypter';

export const urlToDecryptedBlobMap = new Map<
  string,
  { decrypted: string; lastAccessTimestamp: number; forceRetain: boolean }
>();
export const urlToDecryptingPromise = new Map<string, Promise<string>>();

export const cleanUpOldDecryptedMedias = () => {
  const currentTimestamp = Date.now();
  let countCleaned = 0;
  let countKept = 0;
  let keptAsAvatars = 0;

  window?.log?.info('Starting cleaning of medias blobs...');
  for (const iterator of urlToDecryptedBlobMap) {
    if (
      iterator[1].forceRetain &&
      iterator[1].lastAccessTimestamp < currentTimestamp - DURATION.DAYS * 7
    ) {
      // keep forceRetained items for at most 7 days
      keptAsAvatars++;
    } else if (iterator[1].lastAccessTimestamp < currentTimestamp - DURATION.HOURS * 1) {
      // if the last access is older than one hour, revoke the url and remove it.

      URL.revokeObjectURL(iterator[1].decrypted);
      urlToDecryptedBlobMap.delete(iterator[0]);
      countCleaned++;
    } else {
      countKept++;
    }
  }
  window?.log?.info(
    `Clean medias blobs: cleaned/kept/keptAsAvatars: ${countCleaned}:${countKept}:${keptAsAvatars}`
  );
};

export const getLocalAttachmentPath = () => {
  return getAttachmentPath();
};

export const readFileContent = async (url: string) => {
  return fse.readFile(url);
};

export const getDecryptedMediaUrl = async (
  url: string,
  contentType: string,
  isAvatar: boolean
): Promise<string> => {
  if (!url) {
    return url;
  }
  if (url.startsWith('blob:')) {
    return url;
  } else if (exports.getLocalAttachmentPath && url.startsWith(exports.getLocalAttachmentPath())) {
    // this is a file encoded by session on our current attachments path.
    // we consider the file is encrypted.
    // if it's not, the hook caller has to fallback to setting the img src as an url to the file instead and load it
    if (urlToDecryptedBlobMap.has(url)) {
      // refresh the last access timestamp so we keep the one being currently in use
      const existing = urlToDecryptedBlobMap.get(url);
      const existingObjUrl = existing?.decrypted as string;

      urlToDecryptedBlobMap.set(url, {
        decrypted: existingObjUrl,
        lastAccessTimestamp: Date.now(),
        forceRetain: existing?.forceRetain || false,
      });
      // typescript does not realize that the has above makes sure the get is not undefined

      return existingObjUrl;
    } else {
      if (urlToDecryptingPromise.has(url)) {
        return urlToDecryptingPromise.get(url) as Promise<string>;
      }

      urlToDecryptingPromise.set(
        url,
        new Promise(async resolve => {
          window.log.info('about to read and decrypt file :', url);
          try {
            const encryptedFileContent = await readFileContent(url);
            const decryptedContent = await decryptAttachmentBufferRenderer(
              encryptedFileContent.buffer
            );
            if (decryptedContent?.length) {
              const arrayBuffer = decryptedContent.buffer;
              const obj = makeObjectUrl(arrayBuffer, contentType);

              if (!urlToDecryptedBlobMap.has(url)) {
                urlToDecryptedBlobMap.set(url, {
                  decrypted: obj,
                  lastAccessTimestamp: Date.now(),
                  forceRetain: isAvatar,
                });
              }
              window.log.info(' file decrypted :', url, ' as ', obj);
              urlToDecryptingPromise.delete(url);
              resolve(obj);
              return;
            } else {
              // failed to decrypt, fallback to url image loading
              // it might be a media we received before the update encrypting attachments locally.
              urlToDecryptingPromise.delete(url);
              window.log.info('error decrypting file :', url);
              resolve(url);

              return;
            }
          } catch (e) {
            window.log.warn(e);
          }
        })
      );

      return urlToDecryptingPromise.get(url) as Promise<string>;
    }
  } else {
    // Not sure what we got here. Just return the file.

    return url;
  }
};

/**
 *
 * Returns the already decrypted URL or null
 */
export const getAlreadyDecryptedMediaUrl = (url: string): string | null => {
  if (!url) {
    return null;
  }
  if (url.startsWith('blob:')) {
    return url;
  } else if (exports.getLocalAttachmentPath() && url.startsWith(exports.getLocalAttachmentPath())) {
    if (urlToDecryptedBlobMap.has(url)) {
      const existingObjUrl = urlToDecryptedBlobMap.get(url)?.decrypted as string;
      return existingObjUrl;
    }
  }
  return null;
};

export const getDecryptedBlob = async (url: string, contentType: string): Promise<Blob> => {
  const decryptedUrl = await getDecryptedMediaUrl(url, contentType, false);
  return urlToBlob(decryptedUrl);
};

/**
 * This function should only be used for testing purpose
 */
export const resetDecryptedUrlForTesting = () => {
  urlToDecryptedBlobMap.clear();
  urlToDecryptingPromise.clear();
};
