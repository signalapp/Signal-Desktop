import { useEffect, useRef, useState } from 'react';

import {
  getAlreadyDecryptedMediaUrl,
  getDecryptedMediaUrl,
} from '../session/crypto/DecryptedAttachmentsManager';
import { perfEnd, perfStart } from '../session/utils/Performance';

export const useEncryptedFileFetch = (url: string, contentType: string, isAvatar: boolean) => {
  // tslint:disable-next-line: no-bitwise
  const [urlToLoad, setUrlToLoad] = useState('');
  const [loading, setLoading] = useState(false);

  const mountedRef = useRef(true);

  async function fetchUrl() {
    perfStart(`getDecryptedMediaUrl-${url}`);

    const decryptedUrl = await getDecryptedMediaUrl(url, contentType, isAvatar);
    perfEnd(`getDecryptedMediaUrl-${url}`, `getDecryptedMediaUrl-${url}`);

    if (mountedRef.current) {
      setUrlToLoad(decryptedUrl);

      setLoading(false);
    }
  }
  const alreadyDecrypted = getAlreadyDecryptedMediaUrl(url);

  useEffect(() => {
    if (alreadyDecrypted) {
      return;
    }
    setLoading(true);
    mountedRef.current = true;
    void fetchUrl();

    return () => {
      mountedRef.current = false;
    };
  }, [url]);

  if (alreadyDecrypted) {
    return { urlToLoad: alreadyDecrypted, loading: false };
  }
  return { urlToLoad, loading };
};
