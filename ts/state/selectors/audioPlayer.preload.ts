// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import {
  getIntl,
  getUserACI,
  getUserConversationId,
  getUserNumber,
} from './user.std.js';
import { getSource, getSourceServiceId } from './message.preload.js';
import {
  getConversationByIdSelector,
  getConversations,
  getConversationSelector,
  getSelectedConversationId,
} from './conversations.dom.js';
import type { StateType } from '../reducer.preload.js';
import { createLogger } from '../../logging/log.std.js';
import { getLocalAttachmentUrl } from '../../util/getLocalAttachmentUrl.std.js';
import type { ReadonlyMessageAttributesType } from '../../model-types.d.ts';
import { getMessageIdForLogging } from '../../util/idForLogging.preload.js';
import * as Attachment from '../../util/Attachment.std.js';
import type { ActiveAudioPlayerStateType } from '../ducks/audioPlayer.preload.js';
import { isVoiceMessagePlayed } from '../../util/isVoiceMessagePlayed.std.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';

const log = createLogger('audioPlayer');

export type VoiceNoteForPlayback = {
  id: string;
  // undefined if download is pending
  url: string | undefined;
  type: 'incoming' | 'outgoing';
  source: string | undefined;
  sourceServiceId: ServiceIdString | undefined;
  isPlayed: boolean;
  messageIdForLogging: string;
  sentAt: number;
  receivedAt: number;
};

export const isPaused = (state: StateType): boolean => {
  return state.audioPlayer.active === undefined;
};

export const selectAudioPlayerActive = (
  state: StateType
): ActiveAudioPlayerStateType | undefined => {
  return state.audioPlayer.active;
};

export const selectVoiceNoteTitle = createSelector(
  getUserNumber,
  getUserACI,
  getUserConversationId,
  getConversationSelector,
  getIntl,
  (ourNumber, ourAci, ourConversationId, conversationSelector, i18n) => {
    return (
      message: Pick<
        ReadonlyMessageAttributesType,
        'type' | 'source' | 'sourceServiceId'
      >
    ) => {
      const source = getSource(message, ourNumber);
      const sourceServiceId = getSourceServiceId(message, ourAci);

      const conversation =
        !source && !sourceServiceId
          ? conversationSelector(ourConversationId)
          : conversationSelector(sourceServiceId || source);

      return conversation.isMe ? i18n('icu:you') : conversation.title;
    };
  }
);

export function extractVoiceNoteForPlayback(
  message: Pick<
    ReadonlyMessageAttributesType,
    | 'id'
    | 'type'
    | 'attachments'
    | 'isErased'
    | 'errors'
    | 'readStatus'
    | 'sendStateByConversationId'
    | 'sent_at'
    | 'received_at'
    | 'source'
    | 'sourceServiceId'
  >,
  ourConversationId: string | undefined
): VoiceNoteForPlayback | undefined {
  const { type } = message;
  if (type !== 'incoming' && type !== 'outgoing') {
    return;
  }
  if (!message.attachments) {
    return;
  }
  const attachment = message.attachments[0];
  if (!attachment || !Attachment.isAudio(message.attachments)) {
    return;
  }
  const voiceNoteUrl = attachment.path
    ? getLocalAttachmentUrl(attachment)
    : undefined;

  return {
    id: message.id,
    url: voiceNoteUrl,
    type,
    isPlayed: isVoiceMessagePlayed(message, ourConversationId),
    messageIdForLogging: getMessageIdForLogging(message),
    sentAt: message.sent_at,
    receivedAt: message.received_at,
    source: message.source,
    sourceServiceId: message.sourceServiceId,
  };
}

/** Data necessary to playback a voice note and any consecutive notes */
export type VoiceNoteAndConsecutiveForPlayback = {
  conversationId: string;
  voiceNote: VoiceNoteForPlayback;
  playbackRate: number;
};
export const selectVoiceNoteAndConsecutive = createSelector(
  getConversations,
  getSelectedConversationId,
  getConversationByIdSelector,
  getUserConversationId,
  (
    conversations,
    selectedConversationId,
    getConversationById,
    ourConversationId
  ) => {
    return (
      messageId: string
    ): VoiceNoteAndConsecutiveForPlayback | undefined => {
      const message = conversations.messagesLookup[messageId];

      if (!message) {
        log.warn('selectVoiceNoteData: message not found', {
          message: messageId,
        });
        return;
      }

      const voiceNote = extractVoiceNoteForPlayback(message, ourConversationId);
      if (!voiceNote) {
        log.warn('selectVoiceNoteData: message not a voice note', {
          message: messageId,
        });
        return undefined;
      }

      if (!selectedConversationId) {
        log.warn('selectVoiceNoteData: no selected conversation id', {
          message: messageId,
        });
        return undefined;
      }

      const conversation = getConversationById(selectedConversationId);

      return {
        conversationId: selectedConversationId,
        voiceNote,
        playbackRate: conversation?.voiceNotePlaybackRate ?? 1,
      };
    };
  }
);
