// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ActionCreatorsMapObject } from 'redux';
import type { ThunkAction } from 'redux-thunk';
import { bindActionCreators } from 'redux';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Type-level function from an action creator (which may be ThunkAction creator) to a
 * bound action creator.
 *
 * binding a thunk action creator changes it from:
 * (params) => ThunkAction<R, ...>
 * to:
 * (params) => R
 *
 * a regular action creator's type is unchanged
 */
type BoundActionCreator<A> = A extends (
  ...params: infer P
) => ThunkAction<infer R, any, any, any>
  ? (...params: P) => R
  : A;

export type BoundActionCreatorsMapObject<T extends ActionCreatorsMapObject> = {
  [Property in keyof T]: BoundActionCreator<T[Property]>;
};

export const useBoundActions = <T extends ActionCreatorsMapObject>(
  actions: T
): BoundActionCreatorsMapObject<T> => {
  const dispatch = useDispatch();

  return useMemo(() => {
    // bindActionCreators from redux has the wrong type when using thunk actions
    // so we cast to the correct type
    return bindActionCreators(
      actions,
      dispatch
    ) as any as BoundActionCreatorsMapObject<T>;
  }, [actions, dispatch]);
};
