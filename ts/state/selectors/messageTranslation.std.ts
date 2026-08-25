// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.ts';
import type {
  MessageTranslationEntryType,
  MessageTranslationStateType,
} from '../ducks/messageTranslation.preload.ts';

const getMessageTranslation = (
  state: StateType
): MessageTranslationStateType => state.messageTranslation;

export const getMessageTranslationAvailability = createSelector(
  getMessageTranslation,
  ({ availability }) => availability === 'available'
);

export const getMessageTranslationTargetLanguage = createSelector(
  getMessageTranslation,
  ({ targetLanguage }) => targetLanguage
);

export function getMessageTranslationEntry(
  state: StateType,
  messageId: string
): MessageTranslationEntryType | undefined {
  return state.messageTranslation.byMessageId[messageId];
}

export function getMessageTranslationShowingOriginal(
  state: StateType,
  messageId: string
): boolean {
  return Boolean(state.messageTranslation.showingOriginal[messageId]);
}
