// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

function getOnlineStatus(): boolean {
  if (window.textsecure) {
    return window.textsecure.server?.isOnline() ?? true;
  }

  // Only for storybook
  return navigator.onLine;
}

export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(getOnlineStatus());

  useEffect(() => {
    const update = () => {
      setIsOnline(getOnlineStatus());
    };

    update();

    window.Whisper.events.on('online', update);
    window.Whisper.events.on('offline', update);

    return () => {
      window.Whisper.events.off('online', update);
      window.Whisper.events.off('offline', update);
    };
  }, []);

  return isOnline;
}
