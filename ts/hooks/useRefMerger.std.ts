// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from 'react';
import { createRefMerger } from '../util/refMerger.std.ts';

export function useRefMerger(): ReturnType<typeof createRefMerger> {
  return useMemo(() => {
    return createRefMerger();
  }, []);
}
