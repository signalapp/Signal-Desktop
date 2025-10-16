// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import type { StateType } from '../../../state/reducer.preload.js';
import { reducer as rootReducer } from '../../../state/reducer.preload.js';
import { noopAction } from '../../../state/ducks/noop.std.js';

import type { PreferredReactionsStateType } from '../../../state/ducks/preferredReactions.preload.js';
import {
  actions,
  getEmptyState,
  reducer,
} from '../../../state/ducks/preferredReactions.preload.js';
import { EmojiSkinTone } from '../../../components/fun/data/emojis.std.js';
import { itemStorage } from '../../../textsecure/Storage.preload.js';

describe('preferred reactions duck', () => {
  const getEmptyRootState = (): StateType =>
    rootReducer(undefined, noopAction());

  const getRootState = (
    preferredReactions: PreferredReactionsStateType
  ): StateType => ({
    ...getEmptyRootState(),
    preferredReactions,
  });

  const stateWithOpenCustomizationModal = {
    ...getEmptyState(),
    customizePreferredReactionsModal: {
      draftPreferredReactions: ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'],
      originalPreferredReactions: ['💙', '👍', '👎', '😂', '😮', '😢'],
      selectedDraftEmojiIndex: undefined,
      isSaving: false as const,
      hadSaveError: false,
    },
  };

  const stateWithOpenCustomizationModalAndSelectedEmoji = {
    ...stateWithOpenCustomizationModal,
    customizePreferredReactionsModal: {
      ...stateWithOpenCustomizationModal.customizePreferredReactionsModal,
      selectedDraftEmojiIndex: 1,
    },
  };

  let sinonSandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('cancelCustomizePreferredReactionsModal', () => {
    const { cancelCustomizePreferredReactionsModal } = actions;

    it("does nothing if the modal isn't open", () => {
      const action = cancelCustomizePreferredReactionsModal();
      const result = reducer(getEmptyState(), action);

      assert.notProperty(result, 'customizePreferredReactionsModal');
    });

    it('closes the modal if open', () => {
      const action = cancelCustomizePreferredReactionsModal();
      const result = reducer(stateWithOpenCustomizationModal, action);

      assert.notProperty(result, 'customizePreferredReactionsModal');
    });
  });

  describe('deselectDraftEmoji', () => {
    const { deselectDraftEmoji } = actions;

    it('is a no-op if the customization modal is not open', () => {
      const state = getEmptyState();
      const action = deselectDraftEmoji();
      const result = reducer(state, action);

      assert.strictEqual(result, state);
    });

    it('is a no-op if no emoji is selected', () => {
      const action = deselectDraftEmoji();
      const result = reducer(stateWithOpenCustomizationModal, action);

      assert.isUndefined(
        result.customizePreferredReactionsModal?.selectedDraftEmojiIndex
      );
    });

    it('deselects a currently-selected emoji', () => {
      const action = deselectDraftEmoji();
      const result = reducer(
        stateWithOpenCustomizationModalAndSelectedEmoji,
        action
      );

      assert.isUndefined(
        result.customizePreferredReactionsModal?.selectedDraftEmojiIndex
      );
    });
  });

  describe('openCustomizePreferredReactionsModal', () => {
    const { openCustomizePreferredReactionsModal } = actions;

    it('opens the customization modal with defaults if no value was stored', () => {
      const emptyRootState = getEmptyRootState();
      const rootState = {
        ...emptyRootState,
        items: {
          ...emptyRootState.items,
          emojiSkinToneDefault: EmojiSkinTone.Type5,
        },
      };

      const dispatch = sinon.spy();
      openCustomizePreferredReactionsModal()(dispatch, () => rootState, null);
      const [action] = dispatch.getCall(0).args;

      const result = reducer(rootState.preferredReactions, action);

      const expectedEmoji = ['❤️', '👍🏿', '👎🏿', '😂', '😮', '😢'];

      assert.deepEqual(result.customizePreferredReactionsModal, {
        draftPreferredReactions: expectedEmoji,
        originalPreferredReactions: expectedEmoji,
        selectedDraftEmojiIndex: undefined,
        isSaving: false,
        hadSaveError: false,
      });
    });

    it('opens the customization modal with stored values', () => {
      const storedPreferredReactionEmoji = ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'];

      const emptyRootState = getEmptyRootState();
      const state = {
        ...emptyRootState,
        items: {
          ...emptyRootState.items,
          preferredReactionEmoji: storedPreferredReactionEmoji,
        },
      };

      const dispatch = sinon.spy();
      openCustomizePreferredReactionsModal()(dispatch, () => state, null);
      const [action] = dispatch.getCall(0).args;

      const result = reducer(state.preferredReactions, action);

      assert.deepEqual(result.customizePreferredReactionsModal, {
        draftPreferredReactions: storedPreferredReactionEmoji,
        originalPreferredReactions: storedPreferredReactionEmoji,
        selectedDraftEmojiIndex: undefined,
        isSaving: false,
        hadSaveError: false,
      });
    });
  });

  describe('replaceSelectedDraftEmoji', () => {
    const { replaceSelectedDraftEmoji } = actions;

    it('is a no-op if the customization modal is not open', () => {
      const state = getEmptyState();
      const action = replaceSelectedDraftEmoji('🦈');
      const result = reducer(state, action);

      assert.strictEqual(result, state);
    });

    it('is a no-op if no emoji is selected', () => {
      const action = replaceSelectedDraftEmoji('💅');
      const result = reducer(stateWithOpenCustomizationModal, action);

      assert.strictEqual(result, stateWithOpenCustomizationModal);
    });

    it('replaces the selected draft emoji and deselects', () => {
      const action = replaceSelectedDraftEmoji('🐱');
      const result = reducer(
        stateWithOpenCustomizationModalAndSelectedEmoji,
        action
      );

      assert.deepStrictEqual(
        result.customizePreferredReactionsModal?.draftPreferredReactions,
        ['✨', '🐱', '🎇', '🦈', '💖', '🅿️']
      );
      assert.isUndefined(
        result.customizePreferredReactionsModal?.selectedDraftEmojiIndex
      );
    });
  });

  describe('resetDraftEmoji', () => {
    const { resetDraftEmoji } = actions;

    function getAction(rootState: Readonly<StateType>) {
      const dispatch = sinon.spy();
      resetDraftEmoji()(dispatch, () => rootState, null);
      const [action] = dispatch.getCall(0).args;
      return action;
    }

    it('is a no-op if the customization modal is not open', () => {
      const rootState = getEmptyRootState();
      const state = rootState.preferredReactions;
      const action = getAction(rootState);
      const result = reducer(state, action);

      assert.strictEqual(result, state);
    });

    it('resets the draft emoji to the defaults', () => {
      const rootState = getRootState(stateWithOpenCustomizationModal);
      const action = getAction(rootState);
      const result = reducer(rootState.preferredReactions, action);

      assert.deepEqual(
        result.customizePreferredReactionsModal?.draftPreferredReactions,
        ['❤️', '👍', '👎', '😂', '😮', '😢']
      );
    });

    it('deselects any selected emoji', () => {
      const rootState = getRootState(
        stateWithOpenCustomizationModalAndSelectedEmoji
      );
      const action = getAction(rootState);
      const result = reducer(rootState.preferredReactions, action);

      assert.isUndefined(
        result.customizePreferredReactionsModal?.selectedDraftEmojiIndex
      );
    });
  });

  describe('savePreferredReactions', () => {
    const { savePreferredReactions } = actions;

    // We want to create a fake ConversationController for testing purposes, and we need
    //   to sidestep typechecking to do that.
    /* eslint-disable @typescript-eslint/no-explicit-any */

    let storagePutStub: sinon.SinonStub;
    let captureChangeStub: sinon.SinonStub;
    let oldConversationController: any;

    beforeEach(() => {
      storagePutStub = sinonSandbox.stub(itemStorage, 'put').resolves();

      oldConversationController = window.ConversationController;

      captureChangeStub = sinonSandbox.stub();
      window.ConversationController = {
        getOurConversationOrThrow: (): any => ({
          captureChange: captureChangeStub,
        }),
      } as any;
    });

    afterEach(() => {
      window.ConversationController = oldConversationController;
    });

    describe('thunk', () => {
      it('saves the preferred reaction emoji to local storage', async () => {
        await savePreferredReactions()(
          sinon.spy(),
          () => getRootState(stateWithOpenCustomizationModal),
          null
        );

        sinon.assert.calledWith(
          storagePutStub,
          'preferredReactionEmoji',
          stateWithOpenCustomizationModal.customizePreferredReactionsModal
            .draftPreferredReactions
        );
      });

      it('on success, enqueues a storage service upload', async () => {
        await savePreferredReactions()(
          sinon.spy(),
          () => getRootState(stateWithOpenCustomizationModal),
          null
        );

        sinon.assert.calledOnce(captureChangeStub);
      });

      it('on success, dispatches a pending action followed by a fulfilled action', async () => {
        const dispatch = sinon.spy();
        await savePreferredReactions()(
          dispatch,
          () => getRootState(stateWithOpenCustomizationModal),
          null
        );

        sinon.assert.calledTwice(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'preferredReactions/SAVE_PREFERRED_REACTIONS_PENDING',
        });
        sinon.assert.calledWith(dispatch, {
          type: 'preferredReactions/SAVE_PREFERRED_REACTIONS_FULFILLED',
        });
      });

      it('on failure, dispatches a pending action followed by a rejected action', async () => {
        storagePutStub.rejects(new Error('something went wrong'));

        const dispatch = sinon.spy();
        await savePreferredReactions()(
          dispatch,
          () => getRootState(stateWithOpenCustomizationModal),
          null
        );

        sinon.assert.calledTwice(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'preferredReactions/SAVE_PREFERRED_REACTIONS_PENDING',
        });
        sinon.assert.calledWith(dispatch, {
          type: 'preferredReactions/SAVE_PREFERRED_REACTIONS_REJECTED',
        });
      });

      it('on failure, does not enqueue a storage service upload', async () => {
        storagePutStub.rejects(new Error('something went wrong'));

        await savePreferredReactions()(
          sinon.spy(),
          () => getRootState(stateWithOpenCustomizationModal),
          null
        );

        sinon.assert.notCalled(captureChangeStub);
      });
    });

    describe('SAVE_PREFERRED_REACTIONS_FULFILLED', () => {
      const action = {
        type: 'preferredReactions/SAVE_PREFERRED_REACTIONS_FULFILLED' as const,
      };

      it("does nothing if the modal isn't open", () => {
        const result = reducer(getEmptyState(), action);

        assert.notProperty(result, 'customizePreferredReactionsModal');
      });

      it('closes the modal if open', () => {
        const result = reducer(stateWithOpenCustomizationModal, action);

        assert.notProperty(result, 'customizePreferredReactionsModal');
      });
    });

    describe('SAVE_PREFERRED_REACTIONS_PENDING', () => {
      const action = {
        type: 'preferredReactions/SAVE_PREFERRED_REACTIONS_PENDING' as const,
      };

      it('marks the modal as "saving"', () => {
        const result = reducer(stateWithOpenCustomizationModal, action);

        assert.isTrue(result.customizePreferredReactionsModal?.isSaving);
      });

      it('clears any previous errors', () => {
        const state = {
          ...stateWithOpenCustomizationModal,
          customizePreferredReactionsModal: {
            ...stateWithOpenCustomizationModal.customizePreferredReactionsModal,
            hadSaveError: true,
          },
        };
        const result = reducer(state, action);

        assert.isFalse(result.customizePreferredReactionsModal?.hadSaveError);
      });

      it('deselects any selected emoji', () => {
        const result = reducer(
          stateWithOpenCustomizationModalAndSelectedEmoji,
          action
        );

        assert.isUndefined(
          result.customizePreferredReactionsModal?.selectedDraftEmojiIndex
        );
      });
    });

    describe('SAVE_PREFERRED_REACTIONS_REJECTED', () => {
      const action = {
        type: 'preferredReactions/SAVE_PREFERRED_REACTIONS_REJECTED' as const,
      };

      it("does nothing if the modal isn't open", () => {
        const state = getEmptyState();
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('stops loading', () => {
        const result = reducer(stateWithOpenCustomizationModal, action);

        assert.isFalse(result.customizePreferredReactionsModal?.isSaving);
      });

      it('saves that there was an error', () => {
        const result = reducer(stateWithOpenCustomizationModal, action);

        assert.isTrue(result.customizePreferredReactionsModal?.hadSaveError);
      });
    });
  });

  describe('selectDraftEmojiToBeReplaced', () => {
    const { selectDraftEmojiToBeReplaced } = actions;

    it('is a no-op if the customization modal is not open', () => {
      const state = getEmptyState();
      const action = selectDraftEmojiToBeReplaced(2);
      const result = reducer(state, action);

      assert.strictEqual(result, state);
    });

    it('is a no-op if the index is out of range', () => {
      const action = selectDraftEmojiToBeReplaced(99);
      const result = reducer(stateWithOpenCustomizationModal, action);

      assert.strictEqual(result, stateWithOpenCustomizationModal);
    });

    it('sets the index as the selected one', () => {
      const action = selectDraftEmojiToBeReplaced(3);
      const result = reducer(stateWithOpenCustomizationModal, action);

      assert.strictEqual(
        result.customizePreferredReactionsModal?.selectedDraftEmojiIndex,
        3
      );
    });
  });
});
