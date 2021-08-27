import { useEffect, useRef, useState } from 'react';

import { getDecryptedMediaUrl } from '../session/crypto/DecryptedAttachmentsManager';
import { perfEnd, perfStart } from '../session/utils/Performance';

export const useEncryptedFileFetch = (url: string, contentType: string) => {
  // tslint:disable-next-line: no-bitwise
  const [urlToLoad, setUrlToLoad] = useState('');
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);

  async function fetchUrl() {
    perfStart(`getDecryptedMediaUrl-${url}`);

    const decryptedUrl = await getDecryptedMediaUrl(url, contentType);
    perfEnd(`getDecryptedMediaUrl-${url}`, `getDecryptedMediaUrl-${url}`);

    if (mountedRef.current) {
      setUrlToLoad(decryptedUrl);

      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    mountedRef.current = true;
    void fetchUrl();

    return () => {
      mountedRef.current = false;
    };
  }, [url]);
  return { urlToLoad, loading };
};
