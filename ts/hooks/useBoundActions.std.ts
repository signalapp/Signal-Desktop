// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ActionCreatorsMapObject } from 'redux';
import type { ThunkActionDispatch } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';

export type BoundActionCreatorsMapObject<T extends ActionCreatorsMapObject> = {
  [Property in keyof T]: ThunkActionDispatch<T[Property]>;
};

export function useBoundActions<T extends ActionCreatorsMapObject>(
  actions: T
): BoundActionCreatorsMapObject<T> {
  const dispatch = useDispatch();

  return useMemo(() => {
    return bindActionCreators(actions, dispatch);
  }, [actions, dispatch]);
}
