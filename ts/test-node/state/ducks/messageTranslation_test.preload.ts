// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  actions,
  getEmptyState,
  reducer,
} from '../../../state/ducks/messageTranslation.preload.ts';

describe('both/state/ducks/messageTranslation', () => {
  const {
    setMessageTranslationAvailability,
    setTargetLanguage,
    toggleShowOriginal,
    clearTranslation,
  } = actions;

  describe('setMessageTranslationAvailability', () => {
    it('updates availability', () => {
      const state = getEmptyState();
      assert.strictEqual(state.availability, 'unknown');

      const nextState = reducer(
        state,
        setMessageTranslationAvailability('available')
      );
      assert.strictEqual(nextState.availability, 'available');
    });
  });

  describe('setTargetLanguage', () => {
    it('updates targetLanguage', () => {
      const state = getEmptyState();
      assert.isNull(state.targetLanguage);

      const nextState = reducer(state, setTargetLanguage('de'));
      assert.strictEqual(nextState.targetLanguage, 'de');
    });
  });

  describe('TRANSLATE_MESSAGE lifecycle', () => {
    const messageId = 'message-1';

    it('sets status to pending, then done, on success', () => {
      let state = getEmptyState();

      state = reducer(state, {
        type: 'messageTranslation/TRANSLATE_MESSAGE_PENDING',
        meta: { messageId },
      });
      assert.deepEqual(state.byMessageId[messageId], { status: 'pending' });

      state = reducer(state, {
        type: 'messageTranslation/TRANSLATE_MESSAGE_FULFILLED',
        payload: { sourceLanguage: 'de', translatedText: 'Hello' },
        meta: { messageId },
      });
      assert.deepEqual(state.byMessageId[messageId], {
        status: 'done',
        sourceLanguage: 'de',
        translatedText: 'Hello',
      });
    });

    it('sets status to error with the errorCode on failure', () => {
      let state = getEmptyState();

      state = reducer(state, {
        type: 'messageTranslation/TRANSLATE_MESSAGE_PENDING',
        meta: { messageId },
      });
      state = reducer(state, {
        type: 'messageTranslation/TRANSLATE_MESSAGE_REJECTED',
        error: true,
        payload: new Error('languageNotInstalled'),
        meta: { messageId },
      });

      assert.deepEqual(state.byMessageId[messageId], {
        status: 'error',
        errorCode: 'languageNotInstalled',
      });
    });

    it('treats a non-Error rejection payload as an unknown error code', () => {
      let state = getEmptyState();

      state = reducer(state, {
        type: 'messageTranslation/TRANSLATE_MESSAGE_REJECTED',
        error: true,
        payload: 'not an Error instance',
        meta: { messageId },
      });

      assert.deepEqual(state.byMessageId[messageId], {
        status: 'error',
        errorCode: 'unknown',
      });
    });
  });

  describe('toggleShowOriginal', () => {
    it('flips showingOriginal for the given messageId only', () => {
      const state = getEmptyState();
      let nextState = reducer(state, toggleShowOriginal('a'));
      assert.isTrue(nextState.showingOriginal.a);
      assert.isUndefined(nextState.showingOriginal.b);

      nextState = reducer(nextState, toggleShowOriginal('a'));
      assert.isFalse(nextState.showingOriginal.a);
    });
  });

  describe('clearTranslation', () => {
    it('removes both the translation entry and the showingOriginal flag', () => {
      let state = getEmptyState();
      state = reducer(state, {
        type: 'messageTranslation/TRANSLATE_MESSAGE_FULFILLED',
        payload: { sourceLanguage: 'de', translatedText: 'Hello' },
        meta: { messageId: 'a' },
      });
      state = reducer(state, toggleShowOriginal('a'));
      assert.isDefined(state.byMessageId.a);
      assert.isTrue(state.showingOriginal.a);

      state = reducer(state, clearTranslation('a'));
      assert.isUndefined(state.byMessageId.a);
      assert.isUndefined(state.showingOriginal.a);
    });
  });
});
