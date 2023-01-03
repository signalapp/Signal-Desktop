// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';
import { Sound } from '../../util/Sound';
import * as Errors from '../../types/errors';

import type { StateType as RootStateType } from '../reducer';
import { selectNextConsecutiveVoiceNoteMessageId } from '../selectors/audioPlayer';
import {
  getConversationByIdSelector,
  getSelectedConversationId,
} from '../selectors/conversations';

import type {
  MessageDeletedActionType,
  MessageChangedActionType,
  SelectedConversationChangedActionType,
  ConversationChangedActionType,
} from './conversations';
import {
  SELECTED_CONVERSATION_CHANGED,
  setVoiceNotePlaybackRate,
  markViewed,
} from './conversations';
import * as log from '../../logging/log';

import { strictAssert } from '../../util/assert';
import { globalMessageAudio } from '../../services/globalMessageAudio';
import { isPlayed } from '../../types/Attachment';
import { getMessageIdForLogging } from '../../util/idForLogging';
import { getMessagePropStatus } from '../selectors/message';

// State

export type ActiveAudioPlayerStateType = {
  readonly playing: boolean;
  readonly currentTime: number;
  readonly playbackRate: number;
  readonly duration: number;
};

export type AudioPlayerStateType = {
  readonly active:
    | (ActiveAudioPlayerStateType & { id: string; context: string })
    | undefined;
};

// Actions

/**
 * Sets the current "active" message audio for a particular rendering "context"
 */
export type SetMessageAudioAction = {
  type: 'audioPlayer/SET_MESSAGE_AUDIO';
  payload:
    | {
        id: string;
        context: string;
        playbackRate: number;
        duration: number;
      }
    | undefined;
};

type SetPlaybackRate = {
  type: 'audioPlayer/SET_PLAYBACK_RATE';
  payload: number;
};

type SetIsPlayingAction = {
  type: 'audioPlayer/SET_IS_PLAYING';
  payload: boolean;
};

type CurrentTimeUpdated = {
  type: 'audioPlayer/CURRENT_TIME_UPDATED';
  payload: number;
};

type MessageAudioEnded = {
  type: 'audioPlayer/MESSAGE_AUDIO_ENDED';
};

type DurationChanged = {
  type: 'audioPlayer/DURATION_CHANGED';
  payload: number;
};

type AudioPlayerActionType =
  | SetMessageAudioAction
  | SetIsPlayingAction
  | SetPlaybackRate
  | MessageAudioEnded
  | CurrentTimeUpdated
  | DurationChanged;

// Action Creators

export const actions = {
  loadAndPlayMessageAudio,
  unloadMessageAudio,
  setPlaybackRate,
  setCurrentTime,
  setIsPlaying,
};

export const useActions = (): BoundActionCreatorsMapObject<typeof actions> =>
  useBoundActions(actions);

function setCurrentTime(value: number): CurrentTimeUpdated {
  globalMessageAudio.currentTime = value;
  return {
    type: 'audioPlayer/CURRENT_TIME_UPDATED',
    payload: value,
  };
}

function setIsPlaying(value: boolean): SetIsPlayingAction {
  if (!value) {
    globalMessageAudio.pause();
  } else {
    void globalMessageAudio.play();
  }
  return {
    type: 'audioPlayer/SET_IS_PLAYING',
    payload: value,
  };
}

function setPlaybackRate(
  conversationId: string,
  rate: number
): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetPlaybackRate | ConversationChangedActionType
> {
  return dispatch => {
    globalMessageAudio.playbackRate = rate;
    dispatch({
      type: 'audioPlayer/SET_PLAYBACK_RATE',
      payload: rate,
    });

    // update the preference for the conversation
    dispatch(
      setVoiceNotePlaybackRate({
        conversationId,
        rate,
      })
    );
  };
}

function unloadMessageAudio(): SetMessageAudioAction {
  globalMessageAudio.pause();
  return {
    type: 'audioPlayer/SET_MESSAGE_AUDIO',
    payload: undefined,
  };
}

const stateChangeConfirmUpSound = new Sound({
  src: 'sounds/state-change_confirm-up.ogg',
});
const stateChangeConfirmDownSound = new Sound({
  src: 'sounds/state-change_confirm-down.ogg',
});

/**
 * @param isConsecutive Is this part of a consecutive group (not first though)
 */
function loadAndPlayMessageAudio(
  id: string,
  url: string,
  context: string,
  position: number,
  isConsecutive: boolean
): ThunkAction<
  void,
  RootStateType,
  unknown,
  | SetMessageAudioAction
  | MessageAudioEnded
  | CurrentTimeUpdated
  | SetIsPlayingAction
  | DurationChanged
> {
  return (dispatch, getState) => {
    // set source to new message and start playing
    globalMessageAudio.load({
      src: url,

      onTimeUpdate: () => {
        dispatch({
          type: 'audioPlayer/CURRENT_TIME_UPDATED',
          payload: globalMessageAudio.currentTime,
        });
      },

      onLoadedMetadata: () => {
        strictAssert(
          !Number.isNaN(globalMessageAudio.duration),
          'Audio should have definite duration on `loadedmetadata` event'
        );

        log.info('MessageAudio: `loadedmetadata` event', id);

        // Sync-up audio's time in case if <audio/> loaded its source after
        // user clicked on waveform
        if (getState().audioPlayer.active) {
          globalMessageAudio.currentTime =
            position * globalMessageAudio.duration;
        }
      },

      onDurationChange: () => {
        log.info('MessageAudio: `durationchange` event', id);

        if (!Number.isNaN(globalMessageAudio.duration)) {
          dispatch({
            type: 'audioPlayer/DURATION_CHANGED',
            payload: Math.max(globalMessageAudio.duration, 1e-23),
          });
        }
      },

      onEnded: () => {
        const nextVoiceNoteMessage = selectNextConsecutiveVoiceNoteMessageId(
          getState()
        );

        dispatch({
          type: 'audioPlayer/MESSAGE_AUDIO_ENDED',
        });

        // play the next message
        // for now we can just read the current conversation
        // this won't work when we allow a message to continue to play as the user
        // navigates away from the conversation
        // TODO: DESKTOP-4158
        if (nextVoiceNoteMessage) {
          void stateChangeConfirmUpSound.play();
          dispatch(
            loadAndPlayMessageAudio(
              nextVoiceNoteMessage.id,
              nextVoiceNoteMessage.url,
              context,
              0,
              true
            )
          );
        } else if (isConsecutive) {
          void stateChangeConfirmDownSound.play();
        }
      },
    });

    // mark the message as played
    const message = getState().conversations.messagesLookup[id];
    if (message) {
      const messageIdForLogging = getMessageIdForLogging(message);
      const status = getMessagePropStatus(message, message.conversationId);

      if (message.type === 'incoming' || message.type === 'outgoing') {
        if (!isPlayed(message.type, status, message.readStatus)) {
          markViewed(id);
        } else {
          log.info(
            'audioPlayer.loadAndPlayMessageAudio: message already played',
            { message: messageIdForLogging }
          );
        }
      } else {
        log.warn(
          `audioPlayer.loadAndPlayMessageAudio: message wrong type: ${message.type}`,
          { message: messageIdForLogging }
        );
      }
    } else {
      log.warn('audioPlayer.loadAndPlayMessageAudio: message not found', {
        message: id,
      });
    }

    // set the playback rate to the stored value for the selected conversation
    const conversationId = getSelectedConversationId(getState());
    if (conversationId) {
      const conversation = getConversationByIdSelector(getState())(
        conversationId
      );
      globalMessageAudio.playbackRate =
        conversation?.voiceNotePlaybackRate ?? 1;
    }
    globalMessageAudio.play().catch(error => {
      log.error('MessageAudio: resume error', id, Errors.toLogFormat(error));
      dispatch(unloadMessageAudio());
    });

    dispatch({
      type: 'audioPlayer/SET_MESSAGE_AUDIO',
      payload: {
        id,
        context,
        playbackRate: globalMessageAudio.playbackRate,
        duration: globalMessageAudio.duration,
      },
    });

    dispatch(setIsPlaying(true));
  };
}

export function getEmptyState(): AudioPlayerStateType {
  return {
    active: undefined,
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
  if (action.type === 'audioPlayer/SET_MESSAGE_AUDIO') {
    const { payload } = action;

    return {
      ...state,
      active: payload
        ? {
            ...payload,
            playing: true,
            currentTime: 0,
          }
        : undefined,
    };
  }

  // Reset activeAudioID on conversation change.
  if (action.type === SELECTED_CONVERSATION_CHANGED) {
    return {
      ...state,
      active: undefined,
    };
  }

  if (action.type === 'audioPlayer/CURRENT_TIME_UPDATED') {
    return {
      ...state,
      active: state.active
        ? {
            ...state.active,
            currentTime: action.payload,
          }
        : undefined,
    };
  }

  if (action.type === 'audioPlayer/DURATION_CHANGED') {
    return {
      ...state,
      active: state.active
        ? {
            ...state.active,
            duration: action.payload,
          }
        : undefined,
    };
  }

  if (action.type === 'audioPlayer/MESSAGE_AUDIO_ENDED') {
    return {
      ...state,
      active: undefined,
    };
  }

  if (action.type === 'audioPlayer/SET_IS_PLAYING') {
    return {
      ...state,
      active: state.active
        ? {
            ...state.active,
            playing: action.payload,
          }
        : undefined,
    };
  }

  if (action.type === 'audioPlayer/SET_PLAYBACK_RATE') {
    return {
      ...state,
      active: state.active
        ? {
            ...state.active,
            playbackRate: action.payload,
          }
        : undefined,
    };
  }

  // Reset activeAudioID on when played message is deleted on expiration.
  if (action.type === 'MESSAGE_DELETED') {
    const { id } = action.payload;
    if (state.active?.id !== id) {
      return state;
    }

    return {
      ...state,
      active: undefined,
    };
  }

  // Reset activeAudioID on when played message is deleted for everyone.
  if (action.type === 'MESSAGE_CHANGED') {
    const { id, data } = action.payload;

    if (state.active?.id !== id) {
      return state;
    }

    if (!data.deletedForEveryone) {
      return state;
    }

    return {
      ...state,
      active: undefined,
    };
  }

  return state;
}
