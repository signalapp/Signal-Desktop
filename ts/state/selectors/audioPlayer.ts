// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import { collectFirst } from '../../util/iterables';
import type { StateType } from '../reducer';
import { getConversations } from './conversations';
import { getPropsForAttachment } from './message';

export const isPaused = (state: StateType): boolean => {
  return state.audioPlayer.active === undefined;
};

export const selectActiveVoiceNoteMessageId = (
  state: StateType
): string | undefined => state.audioPlayer.active?.id;

export const selectNextConsecutiveVoiceNoteMessageId = createSelector(
  getConversations,
  selectActiveVoiceNoteMessageId,
  (
    conversations,
    activeVoiceNoteMessageId
  ): { id: string; url: string } | undefined => {
    if (!activeVoiceNoteMessageId) {
      return undefined;
    }

    const currentMessage =
      conversations.messagesLookup[activeVoiceNoteMessageId];
    const conversationMessages =
      conversations.messagesByConversation[currentMessage.conversationId];

    if (!conversationMessages) {
      return undefined;
    }

    const idx = conversationMessages.messageIds.indexOf(
      activeVoiceNoteMessageId
    );
    const nextIdx = idx + 1;

    if (!(nextIdx in conversationMessages.messageIds)) {
      return undefined;
    }

    const nextMessageId = conversationMessages.messageIds[nextIdx];
    const nextMessage = conversations.messagesLookup[nextMessageId];

    if (!nextMessage.attachments) {
      return undefined;
    }

    const voiceNoteUrl = collectFirst(
      nextMessage.attachments.map(getPropsForAttachment),
      a => (a && a.isVoiceMessage && a.url ? a.url : undefined)
    );

    if (!voiceNoteUrl) {
      return undefined;
    }

    return {
      id: nextMessageId,
      url: voiceNoteUrl,
    };
  }
);
