// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { NoopActionType } from './noop';
import type { StateType as RootStateType } from '../reducer';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import type { LinkPreviewSourceType } from '../../types/LinkPreview';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation';
import { maybeGrabLinkPreview } from '../../services/LinkPreview';
import { useBoundActions } from '../../hooks/useBoundActions';

// State

export type LinkPreviewsStateType = {
  readonly linkPreview?: LinkPreviewType;
  readonly source?: LinkPreviewSourceType;
};

// Actions

export const ADD_PREVIEW = 'linkPreviews/ADD_PREVIEW';
export const REMOVE_PREVIEW = 'linkPreviews/REMOVE_PREVIEW';

export type AddLinkPreviewActionType = {
  type: 'linkPreviews/ADD_PREVIEW';
  payload: {
    linkPreview: LinkPreviewType;
    source: LinkPreviewSourceType;
  };
};

export type RemoveLinkPreviewActionType = {
  type: 'linkPreviews/REMOVE_PREVIEW';
};

type LinkPreviewsActionType =
  | AddLinkPreviewActionType
  | RemoveLinkPreviewActionType;

// Action Creators

function debouncedMaybeGrabLinkPreview(
  message: string,
  source: LinkPreviewSourceType
): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return dispatch => {
    maybeGrabLinkPreview(message, source);

    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

function addLinkPreview(
  linkPreview: LinkPreviewType,
  source: LinkPreviewSourceType
): AddLinkPreviewActionType {
  return {
    type: ADD_PREVIEW,
    payload: {
      linkPreview,
      source,
    },
  };
}

function removeLinkPreview(): RemoveLinkPreviewActionType {
  return {
    type: REMOVE_PREVIEW,
  };
}

export const actions = {
  addLinkPreview,
  debouncedMaybeGrabLinkPreview,
  removeLinkPreview,
};

export const useLinkPreviewActions = (): typeof actions =>
  useBoundActions(actions);

// Reducer

export function getEmptyState(): LinkPreviewsStateType {
  return {
    linkPreview: undefined,
  };
}

export function reducer(
  state: Readonly<LinkPreviewsStateType> = getEmptyState(),
  action: Readonly<LinkPreviewsActionType>
): LinkPreviewsStateType {
  if (action.type === ADD_PREVIEW) {
    const { payload } = action;

    return {
      linkPreview: payload.linkPreview,
      source: payload.source,
    };
  }

  if (action.type === REMOVE_PREVIEW) {
    return assignWithNoUnnecessaryAllocation(state, {
      linkPreview: undefined,
      source: undefined,
    });
  }

  return state;
}
