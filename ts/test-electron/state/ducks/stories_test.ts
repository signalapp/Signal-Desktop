// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import path from 'path';
import { assert } from 'chai';
import { v4 as uuid } from 'uuid';

import type { StoriesStateType } from '../../../state/ducks/stories';
import type { MessageAttributesType } from '../../../model-types.d';
import { IMAGE_JPEG } from '../../../types/MIME';
import {
  actions,
  getEmptyState,
  reducer,
  RESOLVE_ATTACHMENT_URL,
} from '../../../state/ducks/stories';
import { noopAction } from '../../../state/ducks/noop';
import { reducer as rootReducer } from '../../../state/reducer';

describe('both/state/ducks/stories', () => {
  const getEmptyRootState = () => ({
    ...rootReducer(undefined, noopAction()),
    stories: getEmptyState(),
  });

  function getStoryMessage(id: string): MessageAttributesType {
    const now = Date.now();

    return {
      conversationId: uuid(),
      id,
      received_at: now,
      sent_at: now,
      timestamp: now,
      type: 'story',
    };
  }

  describe('queueStoryDownload', () => {
    const { queueStoryDownload } = actions;

    it('no attachment, no dispatch', async function test() {
      const storyId = uuid();
      const messageAttributes = getStoryMessage(storyId);

      window.MessageController.register(storyId, messageAttributes);

      const dispatch = sinon.spy();
      await queueStoryDownload(storyId)(dispatch, getEmptyRootState, null);

      sinon.assert.notCalled(dispatch);
    });

    it('downloading, no dispatch', async function test() {
      const storyId = uuid();
      const messageAttributes = {
        ...getStoryMessage(storyId),
        attachments: [
          {
            contentType: IMAGE_JPEG,
            downloadJobId: uuid(),
            pending: true,
            size: 0,
          },
        ],
      };

      window.MessageController.register(storyId, messageAttributes);

      const dispatch = sinon.spy();
      await queueStoryDownload(storyId)(dispatch, getEmptyRootState, null);

      sinon.assert.notCalled(dispatch);
    });

    it('downloaded, no dispatch', async function test() {
      const storyId = uuid();
      const messageAttributes = {
        ...getStoryMessage(storyId),
        attachments: [
          {
            contentType: IMAGE_JPEG,
            path: 'image.jpg',
            url: '/path/to/image.jpg',
            size: 0,
          },
        ],
      };

      window.MessageController.register(storyId, messageAttributes);

      const dispatch = sinon.spy();
      await queueStoryDownload(storyId)(dispatch, getEmptyRootState, null);

      sinon.assert.notCalled(dispatch);
    });

    it('downloaded, but unresolved, we should resolve the path', async function test() {
      const storyId = uuid();
      const attachment = {
        contentType: IMAGE_JPEG,
        path: 'image.jpg',
        size: 0,
      };
      const messageAttributes = {
        ...getStoryMessage(storyId),
        attachments: [attachment],
      };

      const rootState = getEmptyRootState();

      const getState = () => ({
        ...rootState,
        stories: {
          ...rootState.stories,
          stories: [
            {
              ...messageAttributes,
              attachment: messageAttributes.attachments[0],
              messageId: messageAttributes.id,
            },
          ],
        },
      });

      window.MessageController.register(storyId, messageAttributes);

      const dispatch = sinon.spy();
      await queueStoryDownload(storyId)(dispatch, getState, null);

      const action = dispatch.getCall(0).args[0];

      sinon.assert.calledWith(dispatch, {
        type: RESOLVE_ATTACHMENT_URL,
        payload: {
          messageId: storyId,
          attachmentUrl: action.payload.attachmentUrl,
        },
      });
      assert.equal(
        attachment.path,
        path.basename(action.payload.attachmentUrl)
      );

      const stateWithStory: StoriesStateType = {
        ...getEmptyRootState().stories,
        stories: [
          {
            ...messageAttributes,
            messageId: storyId,
            attachment,
          },
        ],
      };

      const nextState = reducer(stateWithStory, action);
      assert.isDefined(nextState.stories);
      assert.equal(
        nextState.stories[0].attachment?.url,
        action.payload.attachmentUrl
      );

      const state = getEmptyRootState().stories;

      const sameState = reducer(state, action);
      assert.isDefined(sameState.stories);
      assert.equal(sameState, state);
    });

    it('not downloaded, queued for download', async function test() {
      const storyId = uuid();
      const messageAttributes = {
        ...getStoryMessage(storyId),
        attachments: [
          {
            contentType: IMAGE_JPEG,
            size: 0,
          },
        ],
      };

      const rootState = getEmptyRootState();

      const getState = () => ({
        ...rootState,
        stories: {
          ...rootState.stories,
          stories: [
            {
              ...messageAttributes,
              attachment: messageAttributes.attachments[0],
              messageId: messageAttributes.id,
            },
          ],
        },
      });

      window.MessageController.register(storyId, messageAttributes);

      const dispatch = sinon.spy();
      await queueStoryDownload(storyId)(dispatch, getState, null);

      sinon.assert.calledWith(dispatch, {
        type: 'NOOP',
        payload: null,
      });
    });
  });
});
