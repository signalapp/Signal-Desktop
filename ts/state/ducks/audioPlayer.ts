// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useBoundActions } from '../../util/hooks';

import { SwitchToAssociatedViewActionType } from './conversations';

// State

export type AudioPlayerStateType = {
  readonly activeAudioID: string | undefined;
};

// Actions

type SetActiveAudioIDAction = {
  type: 'audioPlayer/SET_ACTIVE_AUDIO_ID';
  payload: {
    id: string | undefined;
  };
};

type AudioPlayerActionType = SetActiveAudioIDAction;

// Action Creators

export const actions = {
  setActiveAudioID,
};

export const useActions = (): typeof actions => useBoundActions(actions);

function setActiveAudioID(id: string | undefined): SetActiveAudioIDAction {
  return {
    type: 'audioPlayer/SET_ACTIVE_AUDIO_ID',
    payload: { id },
  };
}

// Reducer

function getEmptyState(): AudioPlayerStateType {
  return {
    activeAudioID: undefined,
  };
}

export function reducer(
  state: Readonly<AudioPlayerStateType> = getEmptyState(),
  action: Readonly<AudioPlayerActionType | SwitchToAssociatedViewActionType>
): AudioPlayerStateType {
  if (action.type === 'audioPlayer/SET_ACTIVE_AUDIO_ID') {
    const { payload } = action;

    return {
      ...state,
      activeAudioID: payload.id,
    };
  }

  // Reset activeAudioID on conversation change.
  if (action.type === 'SWITCH_TO_ASSOCIATED_VIEW') {
    return {
      ...state,
      activeAudioID: undefined,
    };
  }

  return state;
}
