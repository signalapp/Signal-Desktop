import { useEffect, useRef, useState } from 'react';

import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';

export const useEncryptedFileFetch = (url: string, contentType: string) => {
  // tslint:disable-next-line: no-bitwise
  const [urlToLoad, setUrlToLoad] = useState('');
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);

  async function fetchUrl() {
    const decryptedUrl = await getDecryptedMediaUrl(url, contentType);
    if (mountedRef.current) {
      setUrlToLoad(decryptedUrl);

      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchUrl();

    return () => {
      mountedRef.current = false;
    };
  }, [url]);

  return { urlToLoad, loading };
};
