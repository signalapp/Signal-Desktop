// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { noop } from 'lodash';
import { v4 as generateUuid } from 'uuid';

import type { ReduxActions } from '../../../state/types';
import {
  actions,
  getComposerStateForConversation,
  getEmptyState,
  reducer,
} from '../../../state/ducks/composer';
import { noopAction } from '../../../state/ducks/noop';
import { reducer as rootReducer } from '../../../state/reducer';

import { IMAGE_JPEG } from '../../../types/MIME';
import type { AttachmentDraftType } from '../../../types/Attachment';
import { fakeDraftAttachment } from '../../helpers/fakeAttachment';

describe('both/state/ducks/composer', () => {
  const QUOTED_MESSAGE = {
    conversationId: '123',
    id: 'quoted-message-id',
    quote: {
      attachments: [],
      id: 456,
      isViewOnce: false,
      isGiftBadge: false,
      messageId: '789',
      referencedMessageNotFound: false,
    },
  };

  function getRootStateFunction(selectedConversationId?: string) {
    const state = rootReducer(undefined, noopAction());
    return () => ({
      ...state,
      conversations: {
        ...state.conversations,
        selectedConversationId,
      },
    });
  }

  describe('replaceAttachments', () => {
    let oldReduxActions: ReduxActions;
    before(() => {
      oldReduxActions = window.reduxActions;
      window.reduxActions = {
        ...oldReduxActions,
        linkPreviews: {
          ...oldReduxActions?.linkPreviews,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          removeLinkPreview: noop as any,
        },
      };
    });
    after(() => {
      window.reduxActions = oldReduxActions;
    });

    it('replaces the attachments state', () => {
      const { replaceAttachments } = actions;
      const dispatch = sinon.spy();

      const attachments: Array<AttachmentDraftType> = [
        {
          contentType: IMAGE_JPEG,
          clientUuid: generateUuid(),
          pending: true,
          size: 2433,
          path: 'image.jpg',
        },
      ];
      replaceAttachments('123', attachments)(
        dispatch,
        getRootStateFunction('123'),
        null
      );

      const action = dispatch.getCall(0).args[0];
      const state = reducer(getEmptyState(), action);
      const composerState = getComposerStateForConversation(state, '123');
      assert.deepEqual(composerState.attachments, attachments);
    });

    it('sets the high quality setting to false when there are no attachments', () => {
      const { replaceAttachments } = actions;
      const dispatch = sinon.spy();
      const attachments: Array<AttachmentDraftType> = [];

      replaceAttachments('123', attachments)(
        dispatch,
        getRootStateFunction('123'),
        null
      );

      const action = dispatch.getCall(0).args[0];
      const state = reducer(
        {
          ...getEmptyState(),
          conversations: {
            '123': {
              ...getComposerStateForConversation(getEmptyState(), '123'),
              shouldSendHighQualityAttachments: true,
            },
          },
        },
        action
      );
      const composerState = getComposerStateForConversation(state, '123');
      assert.deepEqual(composerState.attachments, attachments);

      assert.deepEqual(composerState.attachments, attachments);
      assert.isUndefined(composerState.shouldSendHighQualityAttachments);
    });

    it('does not update redux if the conversation is not selected', () => {
      const { replaceAttachments } = actions;
      const dispatch = sinon.spy();

      const attachments = [fakeDraftAttachment()];
      replaceAttachments('123', attachments)(
        dispatch,
        getRootStateFunction('456'),
        null
      );

      assert.isNull(dispatch.getCall(0));
    });
  });

  describe('resetComposer', () => {
    it('returns composer back to empty state', () => {
      const { resetComposer } = actions;
      const nextState = reducer(getEmptyState(), resetComposer('456'));

      const composerState = getComposerStateForConversation(nextState, '456');
      assert.deepEqual(nextState, {
        ...getEmptyState(),
        conversations: {
          '456': {
            ...composerState,
            messageCompositionId: composerState.messageCompositionId,
          },
        },
      });
    });
  });

  describe('setMediaQualitySetting', () => {
    it('toggles the media quality setting', () => {
      const { setMediaQualitySetting } = actions;
      const state = getEmptyState();

      const composerState = getComposerStateForConversation(state, '123');
      assert.isUndefined(composerState.shouldSendHighQualityAttachments);

      const nextState = reducer(state, setMediaQualitySetting('123', true));

      const nextComposerState = getComposerStateForConversation(
        nextState,
        '123'
      );
      assert.isTrue(nextComposerState.shouldSendHighQualityAttachments);

      const nextNextState = reducer(
        nextState,
        setMediaQualitySetting('123', false)
      );
      const nextNextComposerState = getComposerStateForConversation(
        nextNextState,
        '123'
      );

      assert.isFalse(nextNextComposerState.shouldSendHighQualityAttachments);

      const notMyConvoState = reducer(
        nextNextState,
        setMediaQualitySetting('456', true)
      );
      const notMineComposerState = getComposerStateForConversation(
        notMyConvoState,
        '123'
      );
      assert.isFalse(
        notMineComposerState.shouldSendHighQualityAttachments,
        'still false for prev convo'
      );
    });
  });

  describe('setQuotedMessage', () => {
    it('sets the quoted message', () => {
      const { setQuotedMessage } = actions;
      const state = getEmptyState();
      const nextState = reducer(state, setQuotedMessage('123', QUOTED_MESSAGE));

      const composerState = getComposerStateForConversation(nextState, '123');
      assert.equal(composerState.quotedMessage?.conversationId, '123');
      assert.equal(composerState.quotedMessage?.quote?.id, 456);
    });
  });
});
