// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import casual from 'casual';

import type {
  DispatchableViewStoryType,
  StoryDataType,
} from '../../../state/ducks/stories';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { MessageAttributesType } from '../../../model-types.d';
import type { StateType as RootStateType } from '../../../state/reducer';
import type { UUIDStringType } from '../../../types/UUID';
import { DurationInSeconds } from '../../../util/durations';
import { TEXT_ATTACHMENT, IMAGE_JPEG } from '../../../types/MIME';
import { ReadStatus } from '../../../messages/MessageReadStatus';
import {
  StoryViewDirectionType,
  StoryViewModeType,
} from '../../../types/Stories';
import { UUID } from '../../../types/UUID';
import { actions, getEmptyState } from '../../../state/ducks/stories';
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
      conversationId: UUID.generate().toString(),
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
      title,
    }: Pick<ConversationType, 'id' | 'hideStory'> & {
      title?: string;
    }): ConversationType {
      return {
        acceptedMessageRequest: true,
        badges: [],
        hideStory,
        id: conversationId,
        isMe: false,
        sharedGroupNames: [],
        title: title || casual.username,
        type: 'direct' as const,
      };
    }

    function getStoryData(
      messageId: string,
      conversationId = UUID.generate().toString(),
      timestampDelta = 0
    ): StoryDataType {
      const now = Date.now();

      return {
        conversationId,
        expirationStartTimestamp: now,
        expireTimer: DurationInSeconds.DAY,
        messageId,
        readStatus: ReadStatus.Unread,
        timestamp: now - timestampDelta,
        type: 'story',
      };
    }

    function getStateFunction(
      stories: Array<StoryDataType>,
      conversationLookup: { [key: string]: ConversationType } = {},
      unviewedStoryConversationIdsSorted: Array<string> = []
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
          selectedStoryData: {
            currentIndex: 0,
            messageId: '',
            numStories: 0,
            storyViewMode: StoryViewModeType.Unread,
            unviewedStoryConversationIdsSorted,
          },
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

    it('closes the viewer when viewing a single story', () => {
      const dispatch = sinon.spy();

      viewStory({
        storyId: UUID.generate().toString(),
        storyViewMode: StoryViewModeType.Single,
        viewDirection: StoryViewDirectionType.Next,
      })(dispatch, getEmptyRootState, null);

      sinon.assert.calledWith(dispatch, {
        type: 'stories/VIEW_STORY',
        payload: undefined,
      });
    });

    it('does not find a story', () => {
      const dispatch = sinon.spy();
      viewStory({
        storyId: UUID.generate().toString(),
        storyViewMode: StoryViewModeType.All,
      })(dispatch, getEmptyRootState, null);

      sinon.assert.calledWith(dispatch, {
        type: 'stories/VIEW_STORY',
        payload: undefined,
      });
    });

    it('selects a specific story', () => {
      const storyId = UUID.generate().toString();

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
          storyViewMode: StoryViewModeType.All,
          unviewedStoryConversationIdsSorted: [],
          viewTarget: undefined,
        },
      });
    });

    describe("navigating within a user's stories", () => {
      it('selects the next story', () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const conversationId = UUID.generate().toString();
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
            storyViewMode: StoryViewModeType.User,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it('selects the prev story', () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const conversationId = UUID.generate().toString();
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
            storyViewMode: StoryViewModeType.User,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it('when in StoryViewModeType.User and we have reached the end, it closes the viewer', () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const conversationId = UUID.generate().toString();
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
      it('does not select hidden stories', () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const conversationId = UUID.generate().toString();
        const conversationIdHide = UUID.generate().toString();

        const getState = getStateFunction(
          [
            {
              ...getStoryData(storyId1, conversationId),
              readStatus: ReadStatus.Viewed,
            },

            // selector looks up conversation by sourceUuid
            {
              ...getStoryData(storyId2, conversationIdHide),
              sourceUuid: conversationIdHide,
            },
            {
              ...getStoryData(storyId3, conversationIdHide),
              sourceUuid: conversationIdHide,
            },
          ],
          {
            [conversationId]: getMockConversation({ id: conversationId }),
            [conversationIdHide]: getMockConversation({
              id: conversationIdHide,
              hideStory: true,
            }),
          },
          [conversationId]
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
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const storyId4 = UUID.generate().toString();
        const conversationId1 = UUID.generate().toString();
        const conversationId2 = UUID.generate().toString();
        const conversationId3 = UUID.generate().toString();

        // conversationId3 - storyId4
        // conversationId1 - storyId1, storyId3
        // conversationId2 - storyId2
        const getState = getStateFunction(
          [
            getStoryData(storyId1, conversationId1, 3),
            {
              ...getStoryData(storyId2, conversationId2, 2),
              readStatus: ReadStatus.Viewed,
            },
            getStoryData(storyId3, conversationId1, 1),
            getStoryData(storyId4, conversationId3),
          ],
          {
            [conversationId1]: getMockConversation({ id: conversationId1 }),
            [conversationId2]: getMockConversation({ id: conversationId2 }),
            [conversationId3]: getMockConversation({ id: conversationId3 }),
          },
          [conversationId3, conversationId1, conversationId2]
        );

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId2,
          storyViewMode: StoryViewModeType.Unread,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: undefined,
        });
      });

      it('correctly goes to previous unviewed story', () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const storyId4 = UUID.generate().toString();
        const conversationId1 = UUID.generate().toString();
        const conversationId2 = UUID.generate().toString();
        const conversationId3 = UUID.generate().toString();

        const unviewedStoryConversationIdsSorted = [
          conversationId3,
          conversationId1,
          conversationId2,
        ];

        const getState = getStateFunction(
          [
            getStoryData(storyId1, conversationId1, 3),
            {
              ...getStoryData(storyId2, conversationId2, 2),
              readStatus: ReadStatus.Viewed,
            },
            getStoryData(storyId3, conversationId1, 1),
            getStoryData(storyId4, conversationId3),
          ],
          {
            [conversationId1]: getMockConversation({ id: conversationId1 }),
            [conversationId2]: getMockConversation({ id: conversationId2 }),
            [conversationId3]: getMockConversation({ id: conversationId3 }),
          },
          unviewedStoryConversationIdsSorted
        );

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId2,
          storyViewMode: StoryViewModeType.Unread,
          viewDirection: StoryViewDirectionType.Previous,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId1,
            numStories: 2,
            storyViewMode: StoryViewModeType.Unread,
            unviewedStoryConversationIdsSorted,
          },
        });
      });

      it('does not close the viewer when playing the next story', () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const storyId4 = UUID.generate().toString();
        const conversationId1 = UUID.generate().toString();
        const conversationId2 = UUID.generate().toString();
        const conversationId3 = UUID.generate().toString();
        const unviewedStoryConversationIdsSorted = [
          conversationId3,
          conversationId2,
          conversationId1,
        ];
        const getState = getStateFunction(
          [
            getStoryData(storyId1, conversationId2, 3),
            getStoryData(storyId2, conversationId1, 2),
            getStoryData(storyId3, conversationId2, 1),
            {
              ...getStoryData(storyId4, conversationId3),
              readStatus: ReadStatus.Viewed,
            },
          ],
          {
            [conversationId1]: getMockConversation({ id: conversationId1 }),
            [conversationId2]: getMockConversation({ id: conversationId2 }),
            [conversationId3]: getMockConversation({ id: conversationId3 }),
          },
          unviewedStoryConversationIdsSorted
        );

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId4,
          storyViewMode: StoryViewModeType.Unread,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId1,
            numStories: 2,
            storyViewMode: StoryViewModeType.Unread,
            unviewedStoryConversationIdsSorted,
          },
        });
      });

      it('closes the viewer when there are no more unviewed stories', () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();

        const conversationId1 = UUID.generate().toString();
        const conversationId2 = UUID.generate().toString();

        const getState = getStateFunction(
          [
            {
              ...getStoryData(storyId1, conversationId1),
              readStatus: ReadStatus.Viewed,
            },
            {
              ...getStoryData(storyId2, conversationId2),
              readStatus: ReadStatus.Viewed,
            },
          ],
          {
            [conversationId1]: getMockConversation({ id: conversationId1 }),
            [conversationId2]: getMockConversation({ id: conversationId2 }),
          },
          [conversationId1]
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

    describe('paging through sent stories', () => {
      function getSentStoryReduxData() {
        const distributionListId1 = UUID.generate().toString();
        const distributionListId2 = UUID.generate().toString();
        const storyDistributionLists = {
          distributionLists: [
            {
              id: distributionListId1,
              name: 'List 1',
              allowsReplies: true,
              isBlockList: false,
              memberUuids: [
                UUID.generate().toString(),
                UUID.generate().toString(),
                UUID.generate().toString(),
              ],
            },
            {
              id: distributionListId2,
              name: 'List 2',
              allowsReplies: true,
              isBlockList: false,
              memberUuids: [
                UUID.generate().toString(),
                UUID.generate().toString(),
                UUID.generate().toString(),
              ],
            },
          ],
        };

        const ourConversationId = UUID.generate().toString();
        const groupConversationId = UUID.generate().toString();

        function getMyStoryData(
          messageId: string,
          storyDistributionListId?: string,
          timestampDelta = 0
        ): StoryDataType {
          const now = Date.now();

          return {
            conversationId: storyDistributionListId
              ? ourConversationId
              : groupConversationId,
            expirationStartTimestamp: now,
            expireTimer: DurationInSeconds.DAY,
            messageId,
            readStatus: ReadStatus.Unread,
            sendStateByConversationId: {},
            storyDistributionListId,
            timestamp: now - timestampDelta,
            type: 'story',
          };
        }

        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const storyId4 = UUID.generate().toString();
        const storyId5 = UUID.generate().toString();
        const myStories = [
          getMyStoryData(storyId1, distributionListId1, 5),
          getMyStoryData(storyId2, distributionListId2, 4),
          getMyStoryData(storyId3, distributionListId1, 3),
          getMyStoryData(storyId4, undefined, 2), // group story
          getMyStoryData(storyId5, distributionListId2, 1),
        ];

        const rootState = getEmptyRootState();

        return {
          storyId1,
          storyId2,
          storyId3,
          storyId4,
          storyId5,

          getState: () => ({
            ...rootState,
            conversations: {
              ...rootState.conversations,
              conversationLookup: {
                [groupConversationId]: getMockConversation({
                  id: groupConversationId,
                  title: 'Group',
                }),
              },
            },
            storyDistributionLists,
            stories: {
              ...rootState.stories,
              stories: myStories,
            },
          }),
        };
      }

      it('closes the viewer when hitting next at the last item', () => {
        const { getState, ...reduxData } = getSentStoryReduxData();
        const { storyId3 } = reduxData;

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId3,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: undefined,
        });
      });

      it('closes the viewer when hitting prev at the first item', () => {
        const { getState, ...reduxData } = getSentStoryReduxData();
        const { storyId2 } = reduxData;

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId2,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Previous,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: undefined,
        });
      });

      it('goes to next story within a distribution list', () => {
        const { getState, ...reduxData } = getSentStoryReduxData();
        const { storyId1, storyId3 } = reduxData;

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId1,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 1,
            messageId: storyId3,
            numStories: 2,
            storyViewMode: StoryViewModeType.MyStories,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it('goes to prev story within a distribution list', () => {
        const { getState, ...reduxData } = getSentStoryReduxData();
        const { storyId1, storyId3 } = reduxData;

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId3,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Previous,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId1,
            numStories: 2,
            storyViewMode: StoryViewModeType.MyStories,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it('goes to the next distribution list', () => {
        const { getState, storyId4, storyId1 } = getSentStoryReduxData();

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId4,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId1,
            numStories: 2,
            storyViewMode: StoryViewModeType.MyStories,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it('goes to the prev distribution list', () => {
        const { getState, ...reduxData } = getSentStoryReduxData();
        const { storyId4, storyId5 } = reduxData;

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId4,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Previous,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 1,
            messageId: storyId5,
            numStories: 2,
            storyViewMode: StoryViewModeType.MyStories,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it('goes next to a group story', () => {
        const { getState, ...reduxData } = getSentStoryReduxData();
        const { storyId4, storyId5 } = reduxData;

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId5,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Next,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId4,
            numStories: 1,
            storyViewMode: StoryViewModeType.MyStories,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it('goes prev to a group story', () => {
        const { getState, ...reduxData } = getSentStoryReduxData();
        const { storyId1, storyId4 } = reduxData;

        const dispatch = sinon.spy();
        viewStory({
          storyId: storyId1,
          storyViewMode: StoryViewModeType.MyStories,
          viewDirection: StoryViewDirectionType.Previous,
        })(dispatch, getState, null);

        sinon.assert.calledWith(dispatch, {
          type: 'stories/VIEW_STORY',
          payload: {
            currentIndex: 0,
            messageId: storyId4,
            numStories: 1,
            storyViewMode: StoryViewModeType.MyStories,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });
    });

    describe('paging through collections of stories', () => {
      function getViewedStoryData(
        storyId: string,
        conversationId?: UUIDStringType,
        timestampDelta = 0
      ): StoryDataType {
        return {
          ...getStoryData(storyId, conversationId, timestampDelta),
          readStatus: ReadStatus.Viewed,
        };
      }

      it("goes to the next user's stories", () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const conversationId2 = UUID.generate().toString();
        const conversationId1 = UUID.generate().toString();
        const getState = getStateFunction(
          [
            getViewedStoryData(storyId1, conversationId1, 0),
            getViewedStoryData(storyId2, conversationId2, 1),
            getViewedStoryData(storyId3, conversationId2, 2),
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
            storyViewMode: StoryViewModeType.All,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });

      it("goes to the prev user's stories", () => {
        const storyId1 = UUID.generate().toString();
        const storyId2 = UUID.generate().toString();
        const storyId3 = UUID.generate().toString();
        const conversationId1 = UUID.generate().toString();
        const conversationId2 = UUID.generate().toString();
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
            storyViewMode: StoryViewModeType.All,
            unviewedStoryConversationIdsSorted: [],
          },
        });
      });
    });
  });

  describe('queueStoryDownload', () => {
    const { queueStoryDownload } = actions;

    it('no attachment, no dispatch', async function test() {
      const storyId = UUID.generate().toString();
      const messageAttributes = getStoryMessage(storyId);

      window.MessageController.register(storyId, messageAttributes);

      const dispatch = sinon.spy();
      await queueStoryDownload(storyId)(dispatch, getEmptyRootState, null);

      sinon.assert.notCalled(dispatch);
    });

    it('downloading, no dispatch', async function test() {
      const storyId = UUID.generate().toString();
      const messageAttributes = {
        ...getStoryMessage(storyId),
        attachments: [
          {
            contentType: IMAGE_JPEG,
            downloadJobId: UUID.generate().toString(),
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
      const storyId = UUID.generate().toString();
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

    it('not downloaded, queued for download', async function test() {
      const storyId = UUID.generate().toString();
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

    it('preview not downloaded, queued for download', async function test() {
      const storyId = UUID.generate().toString();
      const preview = {
        url: 'https://signal.org',
        image: {
          contentType: IMAGE_JPEG,
          size: 0,
        },
      };
      const messageAttributes = {
        ...getStoryMessage(storyId),
        attachments: [
          {
            contentType: TEXT_ATTACHMENT,
            size: 0,
            textAttachment: {
              preview,
            },
          },
        ],
        preview: [preview],
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
