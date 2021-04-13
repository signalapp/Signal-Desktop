import { useEffect, useState } from 'react';

import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';

export const useEncryptedFileFetch = (url: string, contentType: string) => {
  // tslint:disable-next-line: no-bitwise
  const [urlToLoad, setUrlToLoad] = useState('');
  const [loading, setLoading] = useState(true);

  async function fetchUrl() {
    const decryptedUrl = await getDecryptedMediaUrl(url, contentType);
    setUrlToLoad(decryptedUrl);

    setLoading(false);
  }

  useEffect(() => {
    void fetchUrl();
  }, [url]);

  return { urlToLoad, loading };
};
