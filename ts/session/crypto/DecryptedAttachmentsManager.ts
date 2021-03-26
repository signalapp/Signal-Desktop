/**
 * This file handles attachments for us.
 * If the attachment filepath is an encrypted one. It will decrypt it, cache it, and return the blob url to it.
 */

import toArrayBuffer from 'to-arraybuffer';
import * as fse from 'fs-extra';
import { decryptAttachmentBuffer } from '../../types/Attachment';

// FIXME.
// add a way to clean those from time to time (like every hours?)
// add a way to remove the blob when the attachment file path is removed (message removed?)
const urlToDecryptedBlobMap = new Map<string, string>();

export const getDecryptedAttachmentUrl = async (
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
    console.warn('url:', url, ' has:', urlToDecryptedBlobMap.has(url));
    if (urlToDecryptedBlobMap.has(url)) {
      // typescript does not realize that the has above makes sure the get is not undefined
      return urlToDecryptedBlobMap.get(url) as string;
    } else {
      const encryptedFileContent = await fse.readFile(url);
      const decryptedContent = await decryptAttachmentBuffer(
        toArrayBuffer(encryptedFileContent)
      );
      if (decryptedContent?.length) {
        const arrayBuffer = decryptedContent.buffer;
        const { makeObjectUrl } = window.Signal.Types.VisualAttachment;
        const obj = makeObjectUrl(arrayBuffer, contentType);
        console.warn('makeObjectUrl: ', obj, contentType);

        if (!urlToDecryptedBlobMap.has(url)) {
          urlToDecryptedBlobMap.set(url, obj);
        }
        return obj;
      } else {
        // failed to decrypt, fallback to url image loading
        return url;
      }
    }
  } else {
    // Not sure what we got here. Just return the file.
    return url;
  }
};
