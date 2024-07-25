// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import {
  getIntl,
  getUserACI,
  getUserConversationId,
  getUserNumber,
} from './user';
import { getMessagePropStatus, getSource, getSourceServiceId } from './message';
import {
  getConversationByIdSelector,
  getConversations,
  getConversationSelector,
  getSelectedConversationId,
} from './conversations';
import type { StateType } from '../reducer';
import * as log from '../../logging/log';
import { getLocalAttachmentUrl } from '../../util/getLocalAttachmentUrl';
import type { MessageWithUIFieldsType } from '../ducks/conversations';
import type { ReadonlyMessageAttributesType } from '../../model-types.d';
import { getMessageIdForLogging } from '../../util/idForLogging';
import * as Attachment from '../../types/Attachment';
import type { ActiveAudioPlayerStateType } from '../ducks/audioPlayer';
import { isPlayed } from '../../types/Attachment';
import type { ServiceIdString } from '../../types/ServiceId';

export type VoiceNoteForPlayback = {
  id: string;
  // undefined if download is pending
  url: string | undefined;
  type: 'incoming' | 'outgoing';
  source: string | undefined;
  sourceServiceId: ServiceIdString | undefined;
  isPlayed: boolean;
  messageIdForLogging: string;
  timestamp: number;
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
  message: ReadonlyMessageAttributesType,
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
  const status = getMessagePropStatus(message, ourConversationId);

  return {
    id: message.id,
    url: voiceNoteUrl,
    type,
    isPlayed: isPlayed(type, status, message.readStatus),
    messageIdForLogging: getMessageIdForLogging(message),
    timestamp: message.timestamp,
    source: message.source,
    sourceServiceId: message.sourceServiceId,
  };
}

/** Data necessary to playback a voice note and any consecutive notes */
export type VoiceNoteAndConsecutiveForPlayback = {
  conversationId: string;
  voiceNote: VoiceNoteForPlayback;
  previousMessageId: string | undefined;
  consecutiveVoiceNotes: ReadonlyArray<VoiceNoteForPlayback>;
  playbackRate: number;
  // timestamp of the message after all the once in the queue
  nextMessageTimestamp: number | undefined;
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

      const conversationMessages =
        conversations.messagesByConversation[selectedConversationId];

      if (!conversationMessages) {
        log.warn('selectedVoiceNote: no conversation messages', {
          message: messageId,
        });
        return;
      }

      let idx = conversationMessages.messageIds.indexOf(messageId);

      // useful if inserting into an active queue
      const previousMessageId = conversationMessages.messageIds[idx - 1];

      const consecutiveVoiceNotes: Array<VoiceNoteForPlayback> = [];
      let nextMessageId: string;
      let nextMessage: MessageWithUIFieldsType | undefined;
      let nextVoiceNote: VoiceNoteForPlayback | undefined;
      do {
        idx += 1;
        nextMessageId = conversationMessages.messageIds[idx];
        if (!nextMessageId) {
          nextMessage = undefined;
          break;
        }
        nextMessage = conversations.messagesLookup[nextMessageId];
        if (!nextMessage) {
          break;
        }
        if (nextMessage.deletedForEveryone) {
          continue;
        }
        nextVoiceNote = extractVoiceNoteForPlayback(
          nextMessage,
          ourConversationId
        );
        if (nextVoiceNote) {
          consecutiveVoiceNotes.push(nextVoiceNote);
        }
      } while (nextVoiceNote);

      const conversation = getConversationById(selectedConversationId);

      return {
        conversationId: selectedConversationId,
        voiceNote,
        consecutiveVoiceNotes,
        playbackRate: conversation?.voiceNotePlaybackRate ?? 1,
        previousMessageId,
        nextMessageTimestamp: nextMessage?.timestamp,
      };
    };
  }
);
