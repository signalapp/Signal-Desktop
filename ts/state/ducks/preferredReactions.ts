// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import { omit } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import { replaceIndex } from '../../util/replaceIndex';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import type { StateType as RootStateType } from '../reducer';
import { DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES } from '../../reactions/constants';
import { getPreferredReactionEmoji } from '../../reactions/preferredReactionEmoji';
import { getEmojiSkinTone } from '../selectors/items';
import { convertShortName } from '../../components/emoji/lib';

// State

export type PreferredReactionsStateType = ReadonlyDeep<{
  customizePreferredReactionsModal?: {
    draftPreferredReactions: Array<string>;
    originalPreferredReactions: Array<string>;
    selectedDraftEmojiIndex: undefined | number;
  } & (
    | { isSaving: true; hadSaveError: false }
    | { isSaving: false; hadSaveError: boolean }
  );
}>;

// Actions

const CANCEL_CUSTOMIZE_PREFERRED_REACTIONS_MODAL =
  'preferredReactions/CANCEL_CUSTOMIZE_PREFERRED_REACTIONS_MODAL';
const DESELECT_DRAFT_EMOJI = 'preferredReactions/DESELECT_DRAFT_EMOJI';
const OPEN_CUSTOMIZE_PREFERRED_REACTIONS_MODAL =
  'preferredReactions/OPEN_CUSTOMIZE_PREFERRED_REACTIONS_MODAL';
const REPLACE_SELECTED_DRAFT_EMOJI =
  'preferredReactions/REPLACE_SELECTED_DRAFT_EMOJI';
const RESET_DRAFT_EMOJI = 'preferredReactions/RESET_DRAFT_EMOJI';
const SAVE_PREFERRED_REACTIONS_FULFILLED =
  'preferredReactions/SAVE_PREFERRED_REACTIONS_FULFILLED';
const SAVE_PREFERRED_REACTIONS_PENDING =
  'preferredReactions/SAVE_PREFERRED_REACTIONS_PENDING';
const SAVE_PREFERRED_REACTIONS_REJECTED =
  'preferredReactions/SAVE_PREFERRED_REACTIONS_REJECTED';
const SELECT_DRAFT_EMOJI_TO_BE_REPLACED =
  'preferredReactions/SELECT_DRAFT_EMOJI_TO_BE_REPLACED';

type CancelCustomizePreferredReactionsModalActionType = ReadonlyDeep<{
  type: typeof CANCEL_CUSTOMIZE_PREFERRED_REACTIONS_MODAL;
}>;

type DeselectDraftEmojiActionType = ReadonlyDeep<{
  type: typeof DESELECT_DRAFT_EMOJI;
}>;

type OpenCustomizePreferredReactionsModalActionType = ReadonlyDeep<{
  type: typeof OPEN_CUSTOMIZE_PREFERRED_REACTIONS_MODAL;
  payload: {
    originalPreferredReactions: Array<string>;
  };
}>;

type ReplaceSelectedDraftEmojiActionType = ReadonlyDeep<{
  type: typeof REPLACE_SELECTED_DRAFT_EMOJI;
  payload: string;
}>;

type ResetDraftEmojiActionType = ReadonlyDeep<{
  type: typeof RESET_DRAFT_EMOJI;
  payload: { skinTone: number };
}>;

type SavePreferredReactionsFulfilledActionType = ReadonlyDeep<{
  type: typeof SAVE_PREFERRED_REACTIONS_FULFILLED;
}>;

type SavePreferredReactionsPendingActionType = ReadonlyDeep<{
  type: typeof SAVE_PREFERRED_REACTIONS_PENDING;
}>;

type SavePreferredReactionsRejectedActionType = ReadonlyDeep<{
  type: typeof SAVE_PREFERRED_REACTIONS_REJECTED;
}>;

type SelectDraftEmojiToBeReplacedActionType = ReadonlyDeep<{
  type: typeof SELECT_DRAFT_EMOJI_TO_BE_REPLACED;
  payload: number;
}>;

// Action creators

export const actions = {
  cancelCustomizePreferredReactionsModal,
  deselectDraftEmoji,
  openCustomizePreferredReactionsModal,
  replaceSelectedDraftEmoji,
  resetDraftEmoji,
  savePreferredReactions,
  selectDraftEmojiToBeReplaced,
};

export const usePreferredReactionsActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function cancelCustomizePreferredReactionsModal(): CancelCustomizePreferredReactionsModalActionType {
  return { type: CANCEL_CUSTOMIZE_PREFERRED_REACTIONS_MODAL };
}

function deselectDraftEmoji(): DeselectDraftEmojiActionType {
  return { type: DESELECT_DRAFT_EMOJI };
}

function openCustomizePreferredReactionsModal(): ThunkAction<
  void,
  RootStateType,
  unknown,
  OpenCustomizePreferredReactionsModalActionType
> {
  return (dispatch, getState) => {
    const state = getState();
    const originalPreferredReactions = getPreferredReactionEmoji(
      getState().items.preferredReactionEmoji,
      getEmojiSkinTone(state)
    );
    dispatch({
      type: OPEN_CUSTOMIZE_PREFERRED_REACTIONS_MODAL,
      payload: { originalPreferredReactions },
    });
  };
}

function replaceSelectedDraftEmoji(
  newEmoji: string
): ReplaceSelectedDraftEmojiActionType {
  return {
    type: REPLACE_SELECTED_DRAFT_EMOJI,
    payload: newEmoji,
  };
}

function resetDraftEmoji(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ResetDraftEmojiActionType
> {
  return (dispatch, getState) => {
    const skinTone = getEmojiSkinTone(getState());
    dispatch({ type: RESET_DRAFT_EMOJI, payload: { skinTone } });
  };
}

function savePreferredReactions(): ThunkAction<
  void,
  RootStateType,
  unknown,
  | SavePreferredReactionsFulfilledActionType
  | SavePreferredReactionsPendingActionType
  | SavePreferredReactionsRejectedActionType
> {
  return async (dispatch, getState) => {
    const { draftPreferredReactions } =
      getState().preferredReactions.customizePreferredReactionsModal || {};
    if (!draftPreferredReactions) {
      log.error(
        "savePreferredReactions won't work because the modal is not open"
      );
      return;
    }

    let succeeded = false;

    dispatch({ type: SAVE_PREFERRED_REACTIONS_PENDING });
    try {
      await window.storage.put(
        'preferredReactionEmoji',
        draftPreferredReactions
      );
      succeeded = true;
    } catch (err: unknown) {
      log.warn(Errors.toLogFormat(err));
    }

    if (succeeded) {
      dispatch({ type: SAVE_PREFERRED_REACTIONS_FULFILLED });
      window.ConversationController.getOurConversationOrThrow().captureChange(
        'preferredReactionEmoji'
      );
    } else {
      dispatch({ type: SAVE_PREFERRED_REACTIONS_REJECTED });
    }
  };
}

function selectDraftEmojiToBeReplaced(
  index: number
): SelectDraftEmojiToBeReplacedActionType {
  return {
    type: SELECT_DRAFT_EMOJI_TO_BE_REPLACED,
    payload: index,
  };
}

// Reducer

export function getEmptyState(): PreferredReactionsStateType {
  return {};
}

export function reducer(
  state: Readonly<PreferredReactionsStateType> = getEmptyState(),
  action: Readonly<
    | CancelCustomizePreferredReactionsModalActionType
    | DeselectDraftEmojiActionType
    | OpenCustomizePreferredReactionsModalActionType
    | ReplaceSelectedDraftEmojiActionType
    | ResetDraftEmojiActionType
    | SavePreferredReactionsFulfilledActionType
    | SavePreferredReactionsPendingActionType
    | SavePreferredReactionsRejectedActionType
    | SelectDraftEmojiToBeReplacedActionType
  >
): PreferredReactionsStateType {
  switch (action.type) {
    case CANCEL_CUSTOMIZE_PREFERRED_REACTIONS_MODAL:
    case SAVE_PREFERRED_REACTIONS_FULFILLED:
      return omit(state, ['customizePreferredReactionsModal']);
    case DESELECT_DRAFT_EMOJI:
      if (!state.customizePreferredReactionsModal) {
        return state;
      }
      return {
        ...state,
        customizePreferredReactionsModal: {
          ...state.customizePreferredReactionsModal,
          selectedDraftEmojiIndex: undefined,
        },
      };
    case OPEN_CUSTOMIZE_PREFERRED_REACTIONS_MODAL: {
      const { originalPreferredReactions } = action.payload;
      return {
        ...state,
        customizePreferredReactionsModal: {
          draftPreferredReactions: originalPreferredReactions,
          originalPreferredReactions,
          selectedDraftEmojiIndex: undefined,
          isSaving: false,
          hadSaveError: false,
        },
      };
    }
    case REPLACE_SELECTED_DRAFT_EMOJI: {
      const newEmoji = action.payload;

      const { customizePreferredReactionsModal } = state;
      if (!customizePreferredReactionsModal) {
        return state;
      }

      const { draftPreferredReactions, selectedDraftEmojiIndex } =
        customizePreferredReactionsModal;
      if (selectedDraftEmojiIndex === undefined) {
        return state;
      }

      return {
        ...state,
        customizePreferredReactionsModal: {
          ...customizePreferredReactionsModal,
          draftPreferredReactions: replaceIndex(
            draftPreferredReactions,
            selectedDraftEmojiIndex,
            newEmoji
          ),
          selectedDraftEmojiIndex: undefined,
        },
      };
    }
    case RESET_DRAFT_EMOJI: {
      const { skinTone } = action.payload;
      if (!state.customizePreferredReactionsModal) {
        return state;
      }
      return {
        ...state,
        customizePreferredReactionsModal: {
          ...state.customizePreferredReactionsModal,
          draftPreferredReactions:
            DEFAULT_PREFERRED_REACTION_EMOJI_SHORT_NAMES.map(shortName =>
              convertShortName(shortName, skinTone)
            ),
          selectedDraftEmojiIndex: undefined,
        },
      };
    }
    case SAVE_PREFERRED_REACTIONS_PENDING:
      if (!state.customizePreferredReactionsModal) {
        return state;
      }
      return {
        ...state,
        customizePreferredReactionsModal: {
          ...state.customizePreferredReactionsModal,
          selectedDraftEmojiIndex: undefined,
          isSaving: true,
          hadSaveError: false,
        },
      };
    case SAVE_PREFERRED_REACTIONS_REJECTED:
      if (!state.customizePreferredReactionsModal) {
        return state;
      }
      return {
        ...state,
        customizePreferredReactionsModal: {
          ...state.customizePreferredReactionsModal,
          isSaving: false,
          hadSaveError: true,
        },
      };
    case SELECT_DRAFT_EMOJI_TO_BE_REPLACED: {
      const index = action.payload;
      if (
        !state.customizePreferredReactionsModal ||
        !(
          index in
          state.customizePreferredReactionsModal.draftPreferredReactions
        )
      ) {
        return state;
      }
      return {
        ...state,
        customizePreferredReactionsModal: {
          ...state.customizePreferredReactionsModal,
          selectedDraftEmojiIndex: index,
        },
      };
    }
    default:
      return state;
  }
}
