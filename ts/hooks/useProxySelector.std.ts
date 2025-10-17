// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { memoize } from '@indutny/sneequals';

import type { StateType } from '../state/reducer.preload.js';

export function useProxySelector<Params extends Array<unknown>, Result>(
  selector: (state: StateType, ...params: Params) => Result,
  ...params: Params
): Result {
  const memoized = useMemo(() => memoize(selector), [selector]);

  return useSelector(
    useCallback(
      (state: StateType) => memoized(state, ...params),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [memoized, ...params]
    )
  );
}
