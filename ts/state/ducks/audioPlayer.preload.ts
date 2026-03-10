// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';
import type { ReadonlyDeep } from 'type-fest';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.js';
import { useBoundActions } from '../../hooks/useBoundActions.std.js';

import type { StateType as RootStateType } from '../reducer.preload.js';
import { setVoiceNotePlaybackRate } from './conversations.preload.js';
import { extractVoiceNoteForPlayback } from '../selectors/audioPlayer.preload.js';
import { getUserConversationId } from '../selectors/user.std.js';
import type {
  VoiceNoteAndConsecutiveForPlayback,
  VoiceNoteForPlayback,
} from '../selectors/audioPlayer.preload.js';

import type {
  MessagesAddedActionType,
  MessageDeletedActionType,
  MessageChangedActionType,
  TargetedConversationChangedActionType,
  ConversationsUpdatedActionType,
} from './conversations.preload.js';
import { createLogger } from '../../logging/log.std.js';
import { isAudio } from '../../util/Attachment.std.js';
import { getLocalAttachmentUrl } from '../../util/getLocalAttachmentUrl.std.js';
import { assertDev } from '../../util/assert.std.js';
import { drop } from '../../util/drop.std.js';
import type { RenderingContextType } from '../../types/RenderingContext.d.ts';
import { Sound, SoundType } from '../../util/Sound.std.js';
import { DataReader } from '../../sql/Client.preload.js';

const stateChangeConfirmUpSound = new Sound({
  soundType: SoundType.VoiceNoteEnd,
});

const log = createLogger('audioPlayer');

// State

/** Some audio identified by a URL (currently only used for drafts) */
type AudioPlayerContentDraft = ReadonlyDeep<{
  conversationId: string;
  url: string;
}>;

/** A voice note consecutive playback */
export type AudioPlayerContentVoiceNote = ReadonlyDeep<{
  conversationId: string;
  context: RenderingContextType;
  current: VoiceNoteForPlayback;
  // playing because it followed a message
  // false on the first of a consecutive group
  isConsecutive: boolean;
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

// Helpers

async function getNextVoiceNote({
  current,
  conversationId,
  ourConversationId,
}: {
  current: VoiceNoteForPlayback;
  conversationId: string;
  ourConversationId: string;
}): Promise<VoiceNoteForPlayback | undefined> {
  const results = await DataReader.getSortedMedia({
    conversationId,
    limit: 1,
    messageId: current.id,
    receivedAt: current.receivedAt,
    sentAt: current.sentAt,
    type: 'audio',
    order: 'newer',
  });

  if (results.length === 0) {
    return undefined;
  }

  const { message, attachment } = results[0];
  return extractVoiceNoteForPlayback(
    {
      ...message,
      attachments: [attachment],
      sent_at: message.sentAt,
      received_at: message.receivedAt,
    },
    ourConversationId
  );
}

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

function messageAudioEnded(): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetMessageAudioAction | MessageAudioEnded
> {
  return async (dispatch, getState) => {
    const state = getState();
    const {
      audioPlayer: { active },
    } = state;
    const ourConversationId = getUserConversationId(getState());
    if (ourConversationId == null || active == null) {
      dispatch({
        type: 'audioPlayer/MESSAGE_AUDIO_ENDED',
      });
      return;
    }

    const { content, playbackRate } = active;
    if (content == null || AudioPlayerContent.isDraft(content)) {
      dispatch({
        type: 'audioPlayer/MESSAGE_AUDIO_ENDED',
      });
      return;
    }

    // No consecutive playback in All Media view
    if (content.context === 'AllMedia') {
      dispatch({
        type: 'audioPlayer/MESSAGE_AUDIO_ENDED',
      });
      return;
    }

    const { conversationId, context, current } = content;

    const next = await getNextVoiceNote({
      current,
      conversationId,
      ourConversationId,
    });
    if (next == null) {
      drop(stateChangeConfirmUpSound.play());
      dispatch({
        type: 'audioPlayer/MESSAGE_AUDIO_ENDED',
      });
      return;
    }

    dispatch({
      type: 'audioPlayer/SET_MESSAGE_AUDIO',
      payload: {
        conversationId,
        context,
        current: next,
        isConsecutive: true,
        startPosition: 0,
        playbackRate,
      },
    });
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
      log.warn('setPlaybackRate: No active message audio');
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
  playbackRate,
}: {
  voiceNoteData: VoiceNoteAndConsecutiveForPlayback;
  position: number;
  context: RenderingContextType;
  playbackRate: number;
}): SetMessageAudioAction {
  const { conversationId, voiceNote } = voiceNoteData;
  return {
    type: 'audioPlayer/SET_MESSAGE_AUDIO',
    payload: {
      conversationId,
      context,
      current: voiceNote,
      isConsecutive: false,
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
      `SET_MESSAGE_AUDIO: Starting playback for conversation ${content.conversationId}`
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

  if (action.type === 'audioPlayer/MESSAGE_AUDIO_ENDED') {
    if (!active) {
      return state;
    }
    const { content } = active;
    if (!content) {
      return state;
    }

    log.info('MESSAGE_AUDIO_ENDED: Stopping playback');
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
      return {
        ...state,
        active: undefined,
      };
    }

    return state;
  }

  // Update currently playing message if it just downloaded
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
        'MESSAGE_CHANGED: Adding content url to current-playing message'
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

    return state;
  }

  return state;
}
