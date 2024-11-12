// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import { useBoundActions } from '../../hooks/useBoundActions';

import type { StateType as RootStateType } from '../reducer';
import { setVoiceNotePlaybackRate } from './conversations';
import { extractVoiceNoteForPlayback } from '../selectors/audioPlayer';
import type {
  VoiceNoteAndConsecutiveForPlayback,
  VoiceNoteForPlayback,
} from '../selectors/audioPlayer';

import type {
  MessagesAddedActionType,
  MessageDeletedActionType,
  MessageChangedActionType,
  TargetedConversationChangedActionType,
  ConversationsUpdatedActionType,
} from './conversations';
import * as log from '../../logging/log';
import { isAudio } from '../../types/Attachment';
import { getLocalAttachmentUrl } from '../../util/getLocalAttachmentUrl';
import { assertDev } from '../../util/assert';

// State

/** Some audio identified by a URL (currently only used for drafts) */
type AudioPlayerContentDraft = ReadonlyDeep<{
  conversationId: string;
  url: string;
}>;

/** A voice note, with a queue for consecutive playback */
export type AudioPlayerContentVoiceNote = ReadonlyDeep<{
  conversationId: string;
  context: string;
  current: VoiceNoteForPlayback;
  queue: ReadonlyArray<VoiceNoteForPlayback>;
  nextMessageTimestamp: number | undefined;
  // playing because it followed a message
  // false on the first of a consecutive group
  isConsecutive: boolean;
  ourConversationId: string | undefined;
}>;

export type ActiveAudioPlayerStateType = ReadonlyDeep<{
  playing: boolean;
  currentTime: number;
  playbackRate: number;
  duration: number | undefined; // never zero or NaN
  startPosition: number;
  content: AudioPlayerContentVoiceNote | AudioPlayerContentDraft;
}>;

/* eslint-disable @typescript-eslint/no-namespace */
export namespace AudioPlayerContent {
  export function isVoiceNote(
    content: ActiveAudioPlayerStateType['content']
  ): content is AudioPlayerContentVoiceNote {
    return (
      // satisfies keyof AudioPlayerContentVoiceNote
      ('current' as const) in content
    );
  }
  export function isDraft(
    content: ActiveAudioPlayerStateType['content']
  ): content is AudioPlayerContentDraft {
    return !isVoiceNote(content);
  }
}

export type AudioPlayerStateType = ReadonlyDeep<{
  active: ActiveAudioPlayerStateType | undefined;
}>;

// Actions

export type SetMessageAudioAction = ReadonlyDeep<{
  type: 'audioPlayer/SET_MESSAGE_AUDIO';
  payload:
    | ((AudioPlayerContentVoiceNote | AudioPlayerContentDraft) & {
        playbackRate: number;
        startPosition: number;
      })
    | undefined;
}>;

type SetPlaybackRate = ReadonlyDeep<{
  type: 'audioPlayer/SET_PLAYBACK_RATE';
  payload: number;
}>;

export type SetIsPlayingAction = ReadonlyDeep<{
  type: 'audioPlayer/SET_IS_PLAYING';
  payload: boolean;
}>;

type CurrentTimeUpdated = ReadonlyDeep<{
  type: 'audioPlayer/CURRENT_TIME_UPDATED';
  payload: number;
}>;

type SetPosition = ReadonlyDeep<{
  type: 'audioPlayer/SET_POSITION';
  payload: number;
}>;

type MessageAudioEnded = ReadonlyDeep<{
  type: 'audioPlayer/MESSAGE_AUDIO_ENDED';
}>;

type DurationChanged = ReadonlyDeep<{
  type: 'audioPlayer/DURATION_CHANGED';
  payload: number | undefined;
}>;

type AudioPlayerActionType = ReadonlyDeep<
  | SetMessageAudioAction
  | SetIsPlayingAction
  | SetPlaybackRate
  | MessageAudioEnded
  | CurrentTimeUpdated
  | DurationChanged
  | SetPosition
>;

// Action Creators

export const actions = {
  loadVoiceNoteAudio,
  loadVoiceNoteDraftAudio,
  setPlaybackRate,
  currentTimeUpdated,
  durationChanged,
  setIsPlaying,
  setPosition,
  pauseVoiceNotePlayer,
  unloadMessageAudio,
  messageAudioEnded,
};

function messageAudioEnded(): MessageAudioEnded {
  return {
    type: 'audioPlayer/MESSAGE_AUDIO_ENDED',
  };
}

function durationChanged(value: number | undefined): DurationChanged {
  assertDev(
    !Number.isNaN(value) && (value === undefined || value > 0),
    `Duration must be > 0 if defined, got ${value}`
  );
  return {
    type: 'audioPlayer/DURATION_CHANGED',
    payload: value,
  };
}

export const useAudioPlayerActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function currentTimeUpdated(value: number): CurrentTimeUpdated {
  return {
    type: 'audioPlayer/CURRENT_TIME_UPDATED',
    payload: value,
  };
}

function setPosition(positionAsRatio: number): SetPosition {
  return {
    type: 'audioPlayer/SET_POSITION',
    payload: positionAsRatio,
  };
}

function setPlaybackRate(
  rate: number
): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetPlaybackRate | ConversationsUpdatedActionType
> {
  return (dispatch, getState) => {
    const { audioPlayer } = getState();
    const { active } = audioPlayer;
    if (!active) {
      log.warn('audioPlayer.setPlaybackRate: No active message audio');
      return;
    }
    dispatch({
      type: 'audioPlayer/SET_PLAYBACK_RATE',
      payload: rate,
    });

    // update the preference for the conversation
    const { conversationId } = active.content;
    dispatch(
      setVoiceNotePlaybackRate({
        conversationId,
        rate,
      })
    );
  };
}

/**
 * Load message audio into the "content", the smart MiniPlayer will then play it
 */
function loadVoiceNoteAudio({
  voiceNoteData,
  position,
  context,
  ourConversationId,
  playbackRate,
}: {
  voiceNoteData: VoiceNoteAndConsecutiveForPlayback;
  position: number;
  context: string;
  ourConversationId: string;
  playbackRate: number;
}): SetMessageAudioAction {
  const {
    conversationId,
    voiceNote,
    consecutiveVoiceNotes,
    // playbackRate,
    nextMessageTimestamp,
  } = voiceNoteData;
  return {
    type: 'audioPlayer/SET_MESSAGE_AUDIO',
    payload: {
      conversationId,
      context,
      current: voiceNote,
      queue: consecutiveVoiceNotes,
      isConsecutive: false,
      nextMessageTimestamp,
      ourConversationId,
      startPosition: position,
      playbackRate,
    },
  };
}

export function loadVoiceNoteDraftAudio(
  content: AudioPlayerContentDraft & {
    playbackRate: number;
    startPosition: number;
  }
): SetMessageAudioAction {
  return {
    type: 'audioPlayer/SET_MESSAGE_AUDIO',
    payload: content,
  };
}

function setIsPlaying(value: boolean): SetIsPlayingAction {
  return {
    type: 'audioPlayer/SET_IS_PLAYING',
    payload: value,
  };
}

/**
 * alias for callers that just want to pause any voice notes before starting
 * their own playback: story viewer, media viewer, calling
 */
export function pauseVoiceNotePlayer(): ReturnType<typeof setIsPlaying> {
  return setIsPlaying(false);
}

export function unloadMessageAudio(): SetMessageAudioAction {
  return {
    type: 'audioPlayer/SET_MESSAGE_AUDIO',
    payload: undefined,
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
    | MessagesAddedActionType
    | TargetedConversationChangedActionType
  >
): AudioPlayerStateType {
  const { active } = state;

  if (action.type === 'audioPlayer/SET_MESSAGE_AUDIO') {
    const { payload } = action;

    if (payload === undefined) {
      return {
        ...state,
        active: undefined,
      };
    }

    const { playbackRate, startPosition, ...content } = payload;
    log.info(
      `audioPlayer/SET_MESSAGE_AUDIO: Starting playback for conversation ${content.conversationId}`
    );
    return {
      ...state,
      active: {
        currentTime: 0,
        duration: undefined,
        playing: true,
        playbackRate,
        content,
        startPosition,
      },
    };
  }

  if (action.type === 'audioPlayer/CURRENT_TIME_UPDATED') {
    if (!active) {
      return state;
    }
    return {
      ...state,
      active: {
        ...active,
        currentTime: action.payload,
      },
    };
  }

  if (action.type === 'audioPlayer/DURATION_CHANGED') {
    if (!active) {
      return state;
    }
    return {
      ...state,
      active: {
        ...active,
        duration: action.payload,
      },
    };
  }

  if (action.type === 'audioPlayer/SET_IS_PLAYING') {
    if (!active) {
      return state;
    }
    return {
      ...state,
      active: {
        ...active,
        playing: action.payload,
      },
    };
  }

  if (action.type === 'audioPlayer/SET_POSITION') {
    if (!active) {
      return state;
    }
    return {
      ...state,
      active: {
        ...active,
        startPosition: action.payload,
      },
    };
  }

  if (action.type === 'audioPlayer/SET_PLAYBACK_RATE') {
    if (!active) {
      return state;
    }
    return {
      ...state,
      active: {
        ...active,
        playbackRate: action.payload,
      },
    };
  }

  if (action.type === 'MESSAGES_ADDED') {
    if (!active) {
      return state;
    }
    const { content } = active;

    if (!content) {
      return state;
    }

    if (!AudioPlayerContent.isVoiceNote(content)) {
      return state;
    }

    if (content.conversationId !== action.payload.conversationId) {
      return state;
    }

    const updatedQueue: Array<VoiceNoteForPlayback> = [...content.queue];

    for (const message of action.payload.messages) {
      if (message.deletedForEveryone) {
        continue;
      }
      if (message.timestamp < content.current.timestamp) {
        continue;
      }
      // in range of the queue
      if (
        content.nextMessageTimestamp === undefined ||
        message.timestamp < content.nextMessageTimestamp
      ) {
        if (message.type !== 'incoming' && message.type !== 'outgoing') {
          continue;
        }

        const voiceNote = extractVoiceNoteForPlayback(
          message,
          content.ourConversationId
        );

        // index of the message in the queue after this one
        const idx = updatedQueue.findIndex(
          m => m.timestamp > message.timestamp
        );

        // break up consecutive queue: drop values older than this message
        if (!voiceNote && idx !== -1) {
          updatedQueue.splice(idx);
          continue;
        }
        // insert a new voice note
        if (voiceNote) {
          if (idx === -1) {
            log.info(
              `audioPlayer/MESSAGES_ADDED: Adding voice note ${voiceNote.messageIdForLogging} to end of queue`
            );
            updatedQueue.push(voiceNote);
          } else {
            log.info(
              `audioPlayer/MESSAGES_ADDED: Adding voice note ${voiceNote.messageIdForLogging} to queue at index ${idx}`
            );
            updatedQueue.splice(idx, 0, voiceNote);
          }
        }
      }
    }

    if (updatedQueue.length === content.queue.length) {
      return state;
    }

    return {
      ...state,
      active: {
        ...active,
        content: {
          ...content,
          queue: updatedQueue,
        },
      },
    };
  }

  if (action.type === 'audioPlayer/MESSAGE_AUDIO_ENDED') {
    if (!active) {
      return state;
    }
    const { content } = active;
    if (!content) {
      return state;
    }

    if (AudioPlayerContent.isDraft(content)) {
      log.info(
        'audioPlayer/MESSAGE_AUDIO_ENDED: Voice note was draft, stopping playback'
      );
      return {
        ...state,
        active: undefined,
      };
    }

    const { queue } = content;

    const [nextVoiceNote, ...newQueue] = queue;

    if (nextVoiceNote) {
      log.info(
        `audioPlayer/MESSAGE_AUDIO_ENDED: Starting next voice note ${nextVoiceNote.messageIdForLogging}`
      );
      return {
        ...state,
        active: {
          ...active,
          startPosition: 0,
          content: {
            ...content,
            current: nextVoiceNote,
            queue: newQueue,
            isConsecutive: true,
          },
        },
      };
    }

    log.info('audioPlayer/MESSAGE_AUDIO_ENDED: Stopping playback');
    return {
      ...state,
      active: undefined,
    };
  }

  // Reset active when played message is deleted on expiration or DOE.
  if (
    action.type === 'MESSAGE_DELETED' ||
    (action.type === 'MESSAGE_CHANGED' &&
      action.payload.data.deletedForEveryone)
  ) {
    const { id } = action.payload;

    if (!active) {
      return state;
    }
    const { content } = active;

    if (!AudioPlayerContent.isVoiceNote(content)) {
      return state;
    }

    // if we deleted the message currently being played
    // move on to the next message
    if (content.current.id === id) {
      const [next, ...rest] = content.queue;

      if (!next) {
        log.info(
          'audioPlayer/MESSAGE_DELETED: Removed currently-playing message, stopping playback'
        );
        return {
          ...state,
          active: undefined,
        };
      }

      log.info(
        'audioPlayer/MESSAGE_DELETED: Removed currently-playing message, moving to next in queue'
      );
      return {
        ...state,
        active: {
          ...active,
          content: {
            ...content,
            current: next,
            queue: rest,
          },
        },
      };
    }

    // if we deleted a message on the queue
    // just update the queue
    const message = content.queue.find(el => el.id === id);
    if (message) {
      log.info('audioPlayer/MESSAGE_DELETED: Removed message from the queue');
      return {
        ...state,
        active: {
          ...active,
          content: {
            ...content,
            queue: content.queue.filter(el => el.id !== id),
          },
        },
      };
    }

    return state;
  }

  // if it's a voice note
  // and this event is letting us know that it has downloaded
  // update the url if it's in the queue
  if (action.type === 'MESSAGE_CHANGED') {
    if (!active) {
      return state;
    }
    const { content } = active;

    if (!content) {
      return state;
    }

    if (AudioPlayerContent.isDraft(content)) {
      return state;
    }

    const { id, data } = action.payload;

    const { attachments } = data;
    const attachment = attachments?.[0];
    if (
      !attachments ||
      !attachment ||
      !isAudio(attachments) ||
      !attachment.path
    ) {
      return state;
    }

    const url = getLocalAttachmentUrl(attachment);

    // if we got the url for the current message
    if (
      content.current.id === id &&
      content.current.url === undefined &&
      data.id
    ) {
      log.info(
        'audioPlayer/MESSAGE_CHANGED: Adding content url to current-playing message'
      );
      return {
        ...state,
        active: {
          ...active,
          content: {
            ...content,
            current: {
              ...content.current,
              url,
            },
          },
        },
      };
    }

    // if it's in the queue
    const idx = content.queue.findIndex(v => v.id === id);
    if (idx !== -1) {
      log.info(
        'audioPlayer/MESSAGE_CHANGED: Adding content url to message in queue'
      );
      const updatedQueue = [...content.queue];
      updatedQueue[idx] = {
        ...updatedQueue[idx],
        url,
      };

      return {
        ...state,
        active: {
          ...active,
          content: {
            ...content,
            queue: updatedQueue,
          },
        },
      };
    }

    return state;
  }

  return state;
}
