// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

export function usePageVisibility(): boolean {
  const [result, setResult] = useState(!document.hidden);

  useEffect(() => {
    const updatePageVisibility = () => {
      setResult(!document.hidden);
    };

    updatePageVisibility();

    document.addEventListener('visibilitychange', updatePageVisibility, false);

    return () => {
      document.removeEventListener(
        'visibilitychange',
        updatePageVisibility,
        false
      );
    };
  }, []);

  return result;
}
