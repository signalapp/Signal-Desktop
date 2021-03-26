import { useEffect, useState } from 'react';
import toArrayBuffer from 'to-arraybuffer';
import * as fse from 'fs-extra';
import { decryptAttachmentBuffer } from '../types/Attachment';

const urlToDecryptedBlobMap = new Map<string, string>();

export const useEncryptedFileFetch = (url: string, contentType: string) => {
  // tslint:disable-next-line: no-bitwise
  const [urlToLoad, setUrlToLoad] = useState('');
  const [loading, setLoading] = useState(true);

  async function fetchUrl() {
    if (url.startsWith('blob:')) {
      setUrlToLoad(url);
    } else if (
      window.Signal.Migrations.attachmentsPath &&
      url.startsWith(window.Signal.Migrations.attachmentsPath)
    ) {
      // this is a file encoded by session on our current attachments path.
      // we consider the file is encrypted.
      // if it's not, the hook caller has to fallback to setting the img src as an url to the file instead and load it

      if (urlToDecryptedBlobMap.has(url)) {
        // typescript does not realize that the has above makes sure the get is not undefined
        setUrlToLoad(urlToDecryptedBlobMap.get(url) as string);
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
            urlToDecryptedBlobMap.set(url, obj);
          }
          setUrlToLoad(obj);
        } else {
          // failed to decrypt, fallback to url image loading
          setUrlToLoad(url);
        }
      }
    } else {
      // already a blob.
      setUrlToLoad(url);
    }

    setLoading(false);
  }

  useEffect(() => {
    void fetchUrl();
  }, [url]);

  return { urlToLoad, loading };
};
