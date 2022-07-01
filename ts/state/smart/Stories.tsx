// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import type { PropsType as SmartStoryCreatorPropsType } from './StoryCreator';
import type { PropsType as SmartStoryViewerPropsType } from './StoryViewer';
import { SmartStoryCreator } from './StoryCreator';
import { SmartStoryViewer } from './StoryViewer';
import { Stories } from '../../components/Stories';
import { getMe } from '../selectors/conversations';
import { getIntl, getUserConversationId } from '../selectors/user';
import { getPreferredLeftPaneWidth } from '../selectors/items';
import { getStories } from '../selectors/stories';
import { saveAttachment } from '../../util/saveAttachment';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useStoriesActions } from '../ducks/stories';

function renderStoryCreator({
  onClose,
}: SmartStoryCreatorPropsType): JSX.Element {
  return <SmartStoryCreator onClose={onClose} />;
}

function renderStoryViewer({
  conversationId,
  onClose,
  onNextUserStories,
  onPrevUserStories,
  storyToView,
}: SmartStoryViewerPropsType): JSX.Element {
  return (
    <SmartStoryViewer
      conversationId={conversationId}
      onClose={onClose}
      onNextUserStories={onNextUserStories}
      onPrevUserStories={onPrevUserStories}
      storyToView={storyToView}
    />
  );
}

export function SmartStories(): JSX.Element | null {
  const storiesActions = useStoriesActions();
  const { showConversation, toggleHideStories } = useConversationsActions();
  const { toggleForwardMessageModal } = useGlobalModalActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);

  const isShowingStoriesView = useSelector<StateType, boolean>(
    (state: StateType) => state.stories.isShowingStoriesView
  );

  const preferredWidthFromStorage = useSelector<StateType, number>(
    getPreferredLeftPaneWidth
  );

  const { hiddenStories, myStories, stories } = useSelector(getStories);

  const ourConversationId = useSelector(getUserConversationId);
  const me = useSelector(getMe);

  if (!isShowingStoriesView) {
    return null;
  }

  return (
    <Stories
      hiddenStories={hiddenStories}
      i18n={i18n}
      me={me}
      myStories={myStories}
      onForwardStory={storyId => {
        toggleForwardMessageModal(storyId);
      }}
      onSaveStory={story => {
        if (story.attachment) {
          saveAttachment(story.attachment, story.timestamp);
        }
      }}
      ourConversationId={String(ourConversationId)}
      preferredWidthFromStorage={preferredWidthFromStorage}
      renderStoryCreator={renderStoryCreator}
      renderStoryViewer={renderStoryViewer}
      showConversation={showConversation}
      stories={stories}
      toggleHideStories={toggleHideStories}
      {...storiesActions}
    />
  );
}
