// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useBoundActions } from '../../hooks/useBoundActions';

import type {
  MessageDeletedActionType,
  MessageChangedActionType,
  SelectedConversationChangedActionType,
} from './conversations';
import { SELECTED_CONVERSATION_CHANGED } from './conversations';

// State

export type AudioPlayerStateType = {
  readonly activeAudioID: string | undefined;
  readonly activeAudioContext: string | undefined;
};

// Actions

type SetActiveAudioIDAction = {
  type: 'audioPlayer/SET_ACTIVE_AUDIO_ID';
  payload: {
    id: string | undefined;
    context: string | undefined;
  };
};

type AudioPlayerActionType = SetActiveAudioIDAction;

// Action Creators

export const actions = {
  setActiveAudioID,
};

export const useActions = (): typeof actions => useBoundActions(actions);

function setActiveAudioID(
  id: string | undefined,
  context: string
): SetActiveAudioIDAction {
  return {
    type: 'audioPlayer/SET_ACTIVE_AUDIO_ID',
    payload: { id, context },
  };
}

// Reducer

export function getEmptyState(): AudioPlayerStateType {
  return {
    activeAudioID: undefined,
    activeAudioContext: undefined,
  };
}

export function reducer(
  state: Readonly<AudioPlayerStateType> = getEmptyState(),
  action: Readonly<
    | AudioPlayerActionType
    | MessageDeletedActionType
    | MessageChangedActionType
    | SelectedConversationChangedActionType
  >
): AudioPlayerStateType {
  if (action.type === 'audioPlayer/SET_ACTIVE_AUDIO_ID') {
    const { payload } = action;

    return {
      ...state,
      activeAudioID: payload.id,
      activeAudioContext: payload.context,
    };
  }

  // Reset activeAudioID on conversation change.
  if (action.type === SELECTED_CONVERSATION_CHANGED) {
    return {
      ...state,
      activeAudioID: undefined,
    };
  }

  // Reset activeAudioID on when played message is deleted on expiration.
  if (action.type === 'MESSAGE_DELETED') {
    const { id } = action.payload;
    if (state.activeAudioID !== id) {
      return state;
    }

    return {
      ...state,
      activeAudioID: undefined,
    };
  }

  // Reset activeAudioID on when played message is deleted for everyone.
  if (action.type === 'MESSAGE_CHANGED') {
    const { id, data } = action.payload;

    if (state.activeAudioID !== id) {
      return state;
    }

    if (!data.deletedForEveryone) {
      return state;
    }

    return {
      ...state,
      activeAudioID: undefined,
    };
  }

  return state;
}
