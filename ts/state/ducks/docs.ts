// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

export type DocStateType = ReadonlyDeep<{
  docViewEnabled: boolean;
}>;

// Actions


type ToggleDocViewActionType = ReadonlyDeep<{
  type: 'TOGGLE_DOC_VIEW';
  payload: null;
}>;

export type DocActionType = ReadonlyDeep<ToggleDocViewActionType>;

// Action Creators

export const actions = {
  toggleDocView,
};

export const useDocActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function toggleDocView(): ToggleDocViewActionType {
  return {
    type: 'TOGGLE_DOC_VIEW',
    payload: null,
  };
}

// Reducer

export function getEmptyState(): DocStateType {
  return {
    docViewEnabled: false,
  };
}

export function reducer(
  state: Readonly<DocStateType> = getEmptyState(),
  action: Readonly<DocActionType>
): DocStateType {
  if (action.type === 'TOGGLE_DOC_VIEW') {
    return {
      ...state,
      docViewEnabled: !state.docViewEnabled
    };
  }

  return state;
}
