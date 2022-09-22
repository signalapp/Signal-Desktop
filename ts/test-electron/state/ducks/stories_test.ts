// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import casual from 'casual';
import path from 'path';
import { assert } from 'chai';
import { v4 as uuid } from 'uuid';

import type {
  DispatchableViewStoryType,
  StoriesStateType,
  StoryDataType,
} from '../../../state/ducks/stories';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { MessageAttributesType } from '../../../model-types.d';
import type { StateType as RootStateType } from '../../../state/reducer';
import { DAY } from '../../../util/durations';
import { IMAGE_JPEG } from '../../../types/MIME';
import { ReadStatus } from '../../../messages/MessageReadStatus';
import {
  StoryViewDirectionType,
  StoryViewModeType,
} from '../../../types/Stories';
import {
  actions,
  getEmptyState,
  reducer,
  RESOLVE_ATTACHMENT_URL,
} from '../../../state/ducks/stories';
import { noopAction } from '../../../state/ducks/noop';
import { reducer as rootReducer } from '../../../state/reducer';
import { dropNull } from '../../../util/dropNull';

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

  describe('viewStory', () => {
    function getMockConversation({
      id: conversationId,
      hideStory = false,
    }: Pick<ConversationType, 'id' | 'hideStory'>): ConversationType {
      return {
        acceptedMessageRequest: true,
        badges: [],
        hideStory,
        id: conversationId,
        isMe: false,
        sharedGroupNames: [],
        title: casual.username,
        type: 'direct' as const,
      };
    }

    function getStoryData(
      messageId: string,
      conversationId = uuid()
    ): StoryDataType {
      const now = Date.now();

      return {
        conversationId,
        expirationStartTimestamp: now,
        expireTimer: 1 * DAY,
        messageId,
        readStatus: ReadStatus.Unread,
        timestamp: now,
        type: 'story',
      };
    }

    function getStateFunction(
      stories: Array<StoryDataType>,
      conversationLookup: { [key: string]: ConversationType } = {}
    ): () => RootStateType {
      const rootState = getEmptyRootState();

      return () => ({
        ...rootState,
        conversations: {
          ...rootState.conversations,
          conversationLookup,
        },
        stories: {
          ...rootState.stories,
          stories,
        },
      });
    }

    const viewStory = actions.viewStory as DispatchableViewStoryType;

    it('closes the viewer', () => {
      const dispatch = sinon.spy();

      viewStory({ closeViewer: true })(dispatch, getEmptyRootState, null);

      sinon.assert.calledWith(dispatch, {
        type: 'stories/VIEW_STORY',
        payload: undefined,
      });
    });

    it('does not find a story', () => {
      const dispatch = sinon.spy();
      viewStory({
        storyId: uuid(),
        storyViewMode: StoryViewModeType.All,
      })(dispatch, getEmptyRootState, null);

      sinon.assert.calledWith(dispatch, {
        type: 'stories/VIEW_STORY',
        payload: undefined,
      });
    });

    it('selects a specific story', () => {
      const storyId = uuid();

      const getState = getStateFunction([getStoryData(storyId)]);

      const dispatch = sinon.spy();
      viewStory({
        storyId,
        storyViewMode: StoryViewModeType.All,
      })(dispatch, getState, null);

      sinon.assert.calledWith(dispatch, {
        type: 'stories/VIEW_STORY',
        payload: {
          currentIndex: 0,
          messageId: storyId,
          numStories: 1,
          shouldShowDetailsModal: false,
          storyViewMode: StoryViewModeType.All,
        },
      });
    });

    describe("navigating within a user's stories", () => {
      it('selects the next story', () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const conversationId = uuid();
        const getState = getStateFunction([
          getStoryData(storyId1, conversationId),
          getStoryData(storyId2, conversationId),
          getStoryData(storyId3, conversationId),
        ]);

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId1,
          storyViewMode: StoryViewModeType.User,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 1,
            messageId: storyId2,
            numStories: 3,
            shouldShowDetailsModal: false,
            storyViewMode: StoryViewModeType.User,
          },
        });
      });

      it('selects the prev story', () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const conversationId = uuid();
        const getState = getStateFunction([
          getStoryData(storyId1, conversationId),
          getStoryData(storyId2, conversationId),
          getStoryData(storyId3, conversationId),
        ]);

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId2,
          storyViewMode: StoryViewModeType.User,
          viewDirection: StoryViewDirectionType.Previous,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId1,
            numStories: 3,
            shouldShowDetailsModal: false,
            storyViewMode: StoryViewModeType.User,
          },
        });
      });

      it('when in StoryViewModeType.User and we have reached the end, it closes the viewer', () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const conversationId = uuid();
        const getState = getStateFunction([
          getStoryData(storyId1, conversationId),
          getStoryData(storyId2, conversationId),
          getStoryData(storyId3, conversationId),
        ]);

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId3,
          storyViewMode: StoryViewModeType.User,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: undefined,
        });
      });
    });

    describe('unviewed stories', () => {
      it('finds any unviewed stories and selects them', () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const getState = getStateFunction([
          getStoryData(storyId1),
          {
            ...getStoryData(storyId2),
            readStatus: ReadStatus.Viewed,
          },
          getStoryData(storyId3),
        ]);

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId1,
          storyViewMode: StoryViewModeType.Unread,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId3,
            numStories: 1,
            shouldShowDetailsModal: false,
            storyViewMode: StoryViewModeType.Unread,
          },
        });
      });

      it('does not select hidden stories', () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const conversationId = uuid();

        const getState = getStateFunction(
          [
            getStoryData(storyId1),
            getStoryData(storyId2, conversationId),
            getStoryData(storyId3, conversationId),
          ],
          {
            [conversationId]: getMockConversation({
              id: conversationId,
              hideStory: true,
            }),
          }
        );

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId1,
          storyViewMode: StoryViewModeType.Unread,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: undefined,
        });
      });

      it('does not select stories that precede the currently viewed story', () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const getState = getStateFunction([
          getStoryData(storyId1),
          getStoryData(storyId2),
          getStoryData(storyId3),
        ]);

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId3,
          storyViewMode: StoryViewModeType.Unread,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: undefined,
        });
      });

      it('closes the viewer when there are no more unviewed stories', () => {
        const storyId1 = uuid();
        const storyId2 = uuid();

        const conversationId1 = uuid();
        const conversationId2 = uuid();

        const getState = getStateFunction(
          [
            getStoryData(storyId1, conversationId1),
            {
              ...getStoryData(storyId2, conversationId2),
              readStatus: ReadStatus.Viewed,
            },
          ],
          {
            [conversationId1]: getMockConversation({ id: conversationId1 }),
            [conversationId2]: getMockConversation({ id: conversationId2 }),
          }
        );

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId1,
          storyViewMode: StoryViewModeType.Unread,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: undefined,
        });
      });
    });

    describe('paging through collections of stories', () => {
      function getViewedStoryData(
        storyId: string,
        conversationId?: string
      ): StoryDataType {
        return {
          ...getStoryData(storyId, conversationId),
          readStatus: ReadStatus.Viewed,
        };
      }

      it("goes to the next user's stories", () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const conversationId2 = uuid();
        const conversationId1 = uuid();
        const getState = getStateFunction(
          [
            getViewedStoryData(storyId1, conversationId1),
            getViewedStoryData(storyId2, conversationId2),
            getViewedStoryData(storyId3, conversationId2),
          ],
          {
            [conversationId1]: getMockConversation({ id: conversationId1 }),
            [conversationId2]: getMockConversation({ id: conversationId2 }),
          }
        );

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId1,
          storyViewMode: StoryViewModeType.All,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId2,
            numStories: 2,
            shouldShowDetailsModal: false,
            storyViewMode: StoryViewModeType.All,
          },
        });
      });

      it("goes to the prev user's stories", () => {
        const storyId1 = uuid();
        const storyId2 = uuid();
        const storyId3 = uuid();
        const conversationId1 = uuid();
        const conversationId2 = uuid();
        const getState = getStateFunction(
          [
            getViewedStoryData(storyId1, conversationId2),
            getViewedStoryData(storyId2, conversationId1),
            getViewedStoryData(storyId3, conversationId2),
          ],
          {
            [conversationId1]: getMockConversation({ id: conversationId1 }),
            [conversationId2]: getMockConversation({ id: conversationId2 }),
          }
        );

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId2,
          storyViewMode: StoryViewModeType.All,
          viewDirection: StoryViewDirectionType.Previous,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId1,
            numStories: 2,
            shouldShowDetailsModal: false,
            storyViewMode: StoryViewModeType.All,
          },
        });
      });
    });
  });

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
              expireTimer: messageAttributes.expireTimer,
              expirationStartTimestamp: dropNull(
                messageAttributes.expirationStartTimestamp
              ),
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
            expireTimer: messageAttributes.expireTimer,
            expirationStartTimestamp: dropNull(
              messageAttributes.expirationStartTimestamp
            ),
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
              expireTimer: messageAttributes.expireTimer,
              expirationStartTimestamp: dropNull(
                messageAttributes.expirationStartTimestamp
              ),
            },
          ],
        },
      });

      window.MessageController.register(storyId, messageAttributes);

      const dispatch = sinon.spy();
      await queueStoryDownload(storyId)(dispatch, getState, null);

      sinon.assert.calledWith(dispatch, {
        type: 'stories/QUEUE_STORY_DOWNLOAD',
        payload: storyId,
      });
    });
  });
});
