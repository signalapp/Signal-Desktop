import { useEffect, useState } from 'react';
import toArrayBuffer from 'to-arraybuffer';
import * as fse from 'fs-extra';
import { decryptAttachmentBuffer } from '../types/Attachment';

export const useEncryptedFileFetch = (url: string) => {
  // tslint:disable-next-line: no-bitwise
  const [data, setData] = useState(new Uint8Array());
  const [loading, setLoading] = useState(true);

  async function fetchUrl() {
    // this is a file encoded by session
    //FIXME find another way to know if the file in encrypted or not
    // maybe rely on
    if (url.includes('/attachments.noindex/')) {
      const encryptedFileContent = await fse.readFile(url);
      const decryptedContent = await decryptAttachmentBuffer(
        toArrayBuffer(encryptedFileContent)
      );
      setData(decryptedContent);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchUrl();
  }, [url]);
  return { data, loading };
};
