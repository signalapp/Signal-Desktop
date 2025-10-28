// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

export function useDevicePixelRatio(): number {
  const [result, setResult] = useState(window.devicePixelRatio);

  useEffect(() => {
    const update = () => {
      setResult(window.devicePixelRatio);
    };

    update();

    const mediaQuery = window.matchMedia(
      `screen and (resolution: ${result}dppx)`
    );
    mediaQuery.addEventListener('change', update);

    return () => {
      mediaQuery.removeEventListener('change', update);
    };
  }, [result]);

  return result;
}
