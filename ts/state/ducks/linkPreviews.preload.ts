// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import type {
  LinkPreviewType,
  LinkPreviewForUIType,
} from '../../types/message/LinkPreviews.std.ts';
import type { AttachmentForUIType } from '../../types/Attachment.std.ts';
import type { MaybeGrabLinkPreviewOptionsType } from '../../types/LinkPreview.std.ts';
import { noopAction, type NoopActionType } from './noop.std.ts';
import type { StateType as RootStateType } from '../reducer.preload.ts';
import { LinkPreviewSourceType } from '../../types/LinkPreview.std.ts';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation.std.ts';
import { maybeGrabLinkPreview } from '../../services/LinkPreview.preload.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';
import { getPropsForAttachment } from '../selectors/message.preload.ts';

// State

export type LinkPreviewsStateType = ReadonlyDeep<{
  linkPreview?: LinkPreviewForUIType;
  source?: LinkPreviewSourceType;
}>;

// Actions

export const ADD_PREVIEW = 'linkPreviews/ADD_PREVIEW';
export const REMOVE_PREVIEW = 'linkPreviews/REMOVE_PREVIEW';

export type AddLinkPreviewActionType = ReadonlyDeep<{
  type: 'linkPreviews/ADD_PREVIEW';
  payload: {
    conversationId?: string;
    linkPreview: LinkPreviewForUIType;
    source: LinkPreviewSourceType;
  };
}>;

export type RemoveLinkPreviewActionType = ReadonlyDeep<{
  type: 'linkPreviews/REMOVE_PREVIEW';
  payload: {
    conversationId?: string;
  };
}>;

type LinkPreviewsActionType = ReadonlyDeep<
  AddLinkPreviewActionType | RemoveLinkPreviewActionType
>;

// Action Creators

function debouncedMaybeGrabLinkPreview(
  message: string,
  source: LinkPreviewSourceType,
  options?: MaybeGrabLinkPreviewOptionsType
): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return dispatch => {
    maybeGrabLinkPreview(message, source, options);

    dispatch(noopAction('debouncedMaybeGrabLinkPreview'));
  };
}

function addLinkPreview(
  linkPreview: LinkPreviewType,
  source: LinkPreviewSourceType,
  conversationId?: string
): AddLinkPreviewActionType {
  if (source === LinkPreviewSourceType.Composer) {
    strictAssert(conversationId, 'no conversationId provided');
  }

  let image: AttachmentForUIType | undefined;
  if (linkPreview.image != null) {
    image = {
      ...getPropsForAttachment(linkPreview.image, 'preview', {
        type:
          source === LinkPreviewSourceType.StoryCreator ? 'story' : 'outgoing',
      }),

      // Save URL to the blob (it gets stripped by `getPropsForAttachment`)
      url: linkPreview.image.url,
    };
  }

  return {
    type: ADD_PREVIEW,
    payload: {
      conversationId,
      linkPreview: {
        ...linkPreview,
        image,
      },
      source,
    },
  };
}

function removeLinkPreview(
  conversationId?: string
): RemoveLinkPreviewActionType {
  return {
    type: REMOVE_PREVIEW,
    payload: {
      conversationId,
    },
  };
}

export const actions = {
  addLinkPreview,
  debouncedMaybeGrabLinkPreview,
  removeLinkPreview,
};

export const useLinkPreviewActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

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
