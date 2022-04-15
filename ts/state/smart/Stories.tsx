// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';

import type { LocalizerType } from '../../types/Util';
import type { StateType } from '../reducer';
import type { PropsType as SmartStoryViewerPropsType } from './StoryViewer';
import { SmartStoryViewer } from './StoryViewer';
import { Stories } from '../../components/Stories';
import { getIntl } from '../selectors/user';
import { getPreferredLeftPaneWidth } from '../selectors/items';
import { getStories } from '../selectors/stories';
import { useStoriesActions } from '../ducks/stories';
import { useConversationsActions } from '../ducks/conversations';

function renderStoryViewer({
  conversationId,
  onClose,
  onNextUserStories,
  onPrevUserStories,
}: SmartStoryViewerPropsType): JSX.Element {
  return (
    <SmartStoryViewer
      conversationId={conversationId}
      onClose={onClose}
      onNextUserStories={onNextUserStories}
      onPrevUserStories={onPrevUserStories}
    />
  );
}

export function SmartStories(): JSX.Element | null {
  const storiesActions = useStoriesActions();
  const { openConversationInternal, toggleHideStories } =
    useConversationsActions();

  const i18n = useSelector<StateType, LocalizerType>(getIntl);

  const isShowingStoriesView = useSelector<StateType, boolean>(
    (state: StateType) => state.stories.isShowingStoriesView
  );

  const preferredWidthFromStorage = useSelector<StateType, number>(
    getPreferredLeftPaneWidth
  );

  const { hiddenStories, stories } = useSelector(getStories);

  if (!isShowingStoriesView) {
    return null;
  }

  return (
    <Stories
      hiddenStories={hiddenStories}
      i18n={i18n}
      openConversationInternal={openConversationInternal}
      preferredWidthFromStorage={preferredWidthFromStorage}
      renderStoryViewer={renderStoryViewer}
      stories={stories}
      toggleHideStories={toggleHideStories}
      {...storiesActions}
    />
  );
}
