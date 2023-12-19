// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

export function useValueAtFixedRate<T>(value: T, rate: number): T {
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentValue(value);
    }, rate);
    return () => {
      clearTimeout(timeout);
    };
  }, [value, rate]);

  return currentValue;
}
