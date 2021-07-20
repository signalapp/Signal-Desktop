import { useEffect, useState } from 'react';

import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';

export const useEncryptedFileFetch = (url: string, contentType: string) => {
  // tslint:disable-next-line: no-bitwise
  const [urlToLoad, setUrlToLoad] = useState('');
  const [loading, setLoading] = useState(true);

  let isCancelled = false;

  async function fetchUrl() {
    const decryptedUrl = await getDecryptedMediaUrl(url, contentType);
    if (!isCancelled) {
      setUrlToLoad(decryptedUrl);

      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchUrl();

    () => (isCancelled = true);
  }, [url]);

  return { urlToLoad, loading };
};
