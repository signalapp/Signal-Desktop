// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

export function usePageVisibility(): boolean {
  const [result, setResult] = useState(!document.hidden);

  useEffect(() => {
    const onVisibilityChange = () => {
      setResult(!document.hidden);
    };

    document.addEventListener('visibilitychange', onVisibilityChange, false);

    return () => {
      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
        false
      );
    };
  }, []);

  return result;
}
