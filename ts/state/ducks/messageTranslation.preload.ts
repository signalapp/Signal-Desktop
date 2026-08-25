// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';
import type { ThunkAction } from 'redux-thunk';

import { createLogger } from '../../logging/log.std.ts';
import * as Errors from '../../types/errors.std.ts';
import type { StateType as RootStateType } from '../reducer.preload.ts';
import type { PromiseAction } from '../util.std.ts';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions.std.ts';
import { useBoundActions } from '../../hooks/useBoundActions.std.ts';

const log = createLogger('messageTranslation');

// Error codes that represent an expected, non-buggy outcome — not worth a
// log line. Data, not control flow, so adding a new expected code later is a
// one-line addition here rather than another `&&` clause.
const EXPECTED_ERROR_CODES = new Set([
  'sourceEqualsTarget',
  'noTargetLanguage',
  'languageNotInstalled',
]);

// State

export type MessageTranslationEntryType = ReadonlyDeep<{
  status: 'pending' | 'done' | 'error';
  sourceLanguage?: string;
  translatedText?: string;
  errorCode?: string;
}>;

export type MessageTranslationStateType = ReadonlyDeep<{
  availability: 'unknown' | 'unavailable' | 'available';
  targetLanguage: string | null;
  byMessageId: Record<string, MessageTranslationEntryType>;
  showingOriginal: Record<string, boolean>;
}>;

// Actions

const SET_AVAILABILITY = 'messageTranslation/SET_AVAILABILITY';
const SET_TARGET_LANGUAGE = 'messageTranslation/SET_TARGET_LANGUAGE';
const TRANSLATE_MESSAGE = 'messageTranslation/TRANSLATE_MESSAGE';
const TOGGLE_SHOW_ORIGINAL = 'messageTranslation/TOGGLE_SHOW_ORIGINAL';
const CLEAR_TRANSLATION = 'messageTranslation/CLEAR_TRANSLATION';

type SetAvailabilityActionType = ReadonlyDeep<{
  type: typeof SET_AVAILABILITY;
  payload: MessageTranslationStateType['availability'];
}>;

type SetTargetLanguageActionType = ReadonlyDeep<{
  type: typeof SET_TARGET_LANGUAGE;
  payload: string;
}>;

type TranslateMessagePayloadType = ReadonlyDeep<{
  sourceLanguage: string;
  translatedText: string;
}>;

type TranslateMessageMetaType = ReadonlyDeep<{ messageId: string }>;

type ToggleShowOriginalActionType = ReadonlyDeep<{
  type: typeof TOGGLE_SHOW_ORIGINAL;
  payload: { messageId: string };
}>;

type ClearTranslationActionType = ReadonlyDeep<{
  type: typeof CLEAR_TRANSLATION;
  payload: { messageId: string };
}>;

export type MessageTranslationActionType = ReadonlyDeep<
  | SetAvailabilityActionType
  | SetTargetLanguageActionType
  | PromiseAction<
      typeof TRANSLATE_MESSAGE,
      TranslateMessagePayloadType,
      TranslateMessageMetaType
    >
  | ToggleShowOriginalActionType
  | ClearTranslationActionType
>;

// Action Creators

export const actions = {
  setMessageTranslationAvailability,
  setTargetLanguage,
  translateMessage,
  toggleShowOriginal,
  clearTranslation,
};

export const useMessageTranslationActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function setMessageTranslationAvailability(
  availability: MessageTranslationStateType['availability']
): SetAvailabilityActionType {
  return { type: SET_AVAILABILITY, payload: availability };
}

function setTargetLanguage(language: string): SetTargetLanguageActionType {
  return { type: SET_TARGET_LANGUAGE, payload: language };
}

function toggleShowOriginal(messageId: string): ToggleShowOriginalActionType {
  return { type: TOGGLE_SHOW_ORIGINAL, payload: { messageId } };
}

function clearTranslation(messageId: string): ClearTranslationActionType {
  return { type: CLEAR_TRANSLATION, payload: { messageId } };
}

// Errors thrown here become the REJECTED action's `error`, whose `.message`
// the reducer stores as `errorCode` — kept generic ('unavailable',
// 'sourceEqualsTarget', or whatever code the main-process channel returned)
// so the UI can key off it without depending on Apple-specific vocabulary.
function translateMessage(
  messageId: string,
  text: string
): ThunkAction<
  void,
  RootStateType,
  unknown,
  PromiseAction<
    typeof TRANSLATE_MESSAGE,
    TranslateMessagePayloadType,
    TranslateMessageMetaType
  >
> {
  return (dispatch, getState) => {
    async function run(): Promise<TranslateMessagePayloadType> {
      const { targetLanguage } = getState().messageTranslation;
      if (!targetLanguage) {
        throw new Error('noTargetLanguage');
      }

      const [detectedLanguage] = await window.IPC.translate.detect([text]);
      if (!detectedLanguage) {
        throw new Error('sourceLanguageUnknown');
      }
      if (detectedLanguage === targetLanguage) {
        throw new Error('sourceEqualsTarget');
      }

      const result = await window.IPC.translate.batch(
        detectedLanguage,
        targetLanguage,
        [text]
      );
      if (!result.ok) {
        throw new Error(result.code);
      }

      return {
        sourceLanguage: detectedLanguage,
        translatedText: result.texts[0],
      };
    }

    dispatch({
      type: TRANSLATE_MESSAGE,
      payload: run(),
      meta: { messageId },
    });
  };
}

// Reducer

export function getEmptyState(): MessageTranslationStateType {
  return {
    availability: 'unknown',
    targetLanguage: null,
    byMessageId: {},
    showingOriginal: {},
  };
}

export function reducer(
  state: Readonly<MessageTranslationStateType> = getEmptyState(),
  action: Readonly<MessageTranslationActionType>
): MessageTranslationStateType {
  if (action.type === SET_AVAILABILITY) {
    return { ...state, availability: action.payload };
  }

  if (action.type === SET_TARGET_LANGUAGE) {
    return { ...state, targetLanguage: action.payload };
  }

  if (action.type === TOGGLE_SHOW_ORIGINAL) {
    const { messageId } = action.payload;
    return {
      ...state,
      showingOriginal: {
        ...state.showingOriginal,
        [messageId]: !state.showingOriginal[messageId],
      },
    };
  }

  if (action.type === CLEAR_TRANSLATION) {
    const { messageId } = action.payload;
    const byMessageId = { ...state.byMessageId };
    delete byMessageId[messageId];
    const showingOriginal = { ...state.showingOriginal };
    delete showingOriginal[messageId];
    return { ...state, byMessageId, showingOriginal };
  }

  if (action.type === `${TRANSLATE_MESSAGE}_PENDING`) {
    const { messageId } = action.meta;
    return {
      ...state,
      byMessageId: {
        ...state.byMessageId,
        [messageId]: { status: 'pending' },
      },
    };
  }

  if (action.type === `${TRANSLATE_MESSAGE}_FULFILLED`) {
    const { messageId } = action.meta;
    const { sourceLanguage, translatedText } = action.payload;
    return {
      ...state,
      byMessageId: {
        ...state.byMessageId,
        [messageId]: { status: 'done', sourceLanguage, translatedText },
      },
    };
  }

  if (action.type === (`${TRANSLATE_MESSAGE}_REJECTED` as const)) {
    const { messageId } = action.meta;
    // redux-promise-middleware puts the actual Error on `payload` for a
    // rejected action — `error` is just a boolean `true` flag, not the
    // error itself (see PromiseAction's REJECTED variant in
    // ts/state/util.std.ts). Reading `action.error` here silently always
    // produced 'unknown', discarding every real error code.
    const error = action.payload;
    const errorCode = error instanceof Error ? error.message : 'unknown';
    if (!EXPECTED_ERROR_CODES.has(errorCode)) {
      // Only log genuine failures — these codes are expected outcomes (the
      // message is already in the target language, or the target language
      // pack just isn't downloaded), not bugs worth a log line.
      log.warn(`failed for ${messageId}: ${Errors.toLogFormat(error)}`);
    }
    return {
      ...state,
      byMessageId: {
        ...state.byMessageId,
        [messageId]: { status: 'error', errorCode },
      },
    };
  }

  return state;
}
