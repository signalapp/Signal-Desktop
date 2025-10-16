// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer.preload.js';
import type {
  ComposerStateType,
  QuotedMessageForComposerType,
} from '../ducks/composer.preload.js';
import { getComposerStateForConversation } from '../ducks/composer.preload.js';

export const getComposerState = (state: StateType): ComposerStateType =>
  state.composer;

export const getComposerStateForConversationIdSelector = createSelector(
  getComposerState,
  composer => (conversationId: string) =>
    getComposerStateForConversation(composer, conversationId)
);

export const getQuotedMessageSelector = createSelector(
  getComposerStateForConversationIdSelector,
  composerStateForConversationIdSelector =>
    (conversationId: string): QuotedMessageForComposerType | undefined =>
      composerStateForConversationIdSelector(conversationId).quotedMessage
);
