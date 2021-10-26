// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation';

// State

export type LinkPreviewsStateType = {
  readonly linkPreview?: LinkPreviewType;
};

// Actions

const ADD_PREVIEW = 'linkPreviews/ADD_PREVIEW';
export const REMOVE_PREVIEW = 'linkPreviews/REMOVE_PREVIEW';

type AddLinkPreviewActionType = {
  type: 'linkPreviews/ADD_PREVIEW';
  payload: LinkPreviewType;
};

export type RemoveLinkPreviewActionType = {
  type: 'linkPreviews/REMOVE_PREVIEW';
};

type LinkPreviewsActionType =
  | AddLinkPreviewActionType
  | RemoveLinkPreviewActionType;

// Action Creators

export const actions = {
  addLinkPreview,
  removeLinkPreview,
};

function addLinkPreview(payload: LinkPreviewType): AddLinkPreviewActionType {
  return {
    type: ADD_PREVIEW,
    payload,
  };
}

function removeLinkPreview(): RemoveLinkPreviewActionType {
  return {
    type: REMOVE_PREVIEW,
  };
}

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
      linkPreview: payload,
    };
  }

  if (action.type === REMOVE_PREVIEW) {
    return assignWithNoUnnecessaryAllocation(state, {
      linkPreview: undefined,
    });
  }

  return state;
}
