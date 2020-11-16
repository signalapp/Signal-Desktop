import { useEffect, useState } from 'react';

export function useNetwork() {
  const [isOnline, setNetwork] = useState(window.navigator.onLine);
  const updateNetwork = () => {
    setNetwork(window.navigator.onLine);
  };

  // there are some weird behavior with this api.
  // basically, online events might not be called if the pc has a virtual machine running
  // https://github.com/electron/electron/issues/11290#issuecomment-348598311
  useEffect(() => {
    window.addEventListener('offline', updateNetwork);
    window.addEventListener('online', updateNetwork);

    return () => {
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('online', updateNetwork);
    };
  });
  return isOnline;
}
