// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';
import type { ConversationStoryType, StoryViewType } from './StoryListItem';
import type { LocalizerType } from '../types/Util';
import type { PropsType as SmartStoryViewerPropsType } from '../state/smart/StoryViewer';
import { StoriesPane } from './StoriesPane';
import { Theme, themeClassName } from '../util/theme';
import { getWidthFromPreferredWidth } from '../util/leftPaneWidth';

export type PropsType = {
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  preferredWidthFromStorage: number;
  openConversationInternal: (_: { conversationId: string }) => unknown;
  renderStoryViewer: (props: SmartStoryViewerPropsType) => JSX.Element;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
  toggleStoriesView: () => unknown;
};

type ViewingStoryType = {
  conversationId: string;
  stories: Array<StoryViewType>;
};

export const Stories = ({
  hiddenStories,
  i18n,
  openConversationInternal,
  preferredWidthFromStorage,
  renderStoryViewer,
  stories,
  toggleHideStories,
  toggleStoriesView,
}: PropsType): JSX.Element => {
  const [storiesToView, setStoriesToView] = useState<
    undefined | ViewingStoryType
  >();

  const width = getWidthFromPreferredWidth(preferredWidthFromStorage, {
    requiresFullWidth: true,
  });

  return (
    <div className={classNames('Stories', themeClassName(Theme.Dark))}>
      {storiesToView &&
        renderStoryViewer({
          conversationId: storiesToView.conversationId,
          onClose: () => setStoriesToView(undefined),
          onNextUserStories: () => {
            const storyIndex = stories.findIndex(
              x => x.conversationId === storiesToView.conversationId
            );
            if (storyIndex >= stories.length - 1) {
              setStoriesToView(undefined);
              return;
            }
            const nextStory = stories[storyIndex + 1];
            setStoriesToView({
              conversationId: nextStory.conversationId,
              stories: nextStory.stories,
            });
          },
          onPrevUserStories: () => {
            const storyIndex = stories.findIndex(
              x => x.conversationId === storiesToView.conversationId
            );
            if (storyIndex === 0) {
              setStoriesToView(undefined);
              return;
            }
            const prevStory = stories[storyIndex - 1];
            setStoriesToView({
              conversationId: prevStory.conversationId,
              stories: prevStory.stories,
            });
          },
          stories: storiesToView.stories,
        })}
      <div className="Stories__pane" style={{ width }}>
        <StoriesPane
          hiddenStories={hiddenStories}
          i18n={i18n}
          onBack={toggleStoriesView}
          onStoryClicked={conversationId => {
            const storyIndex = stories.findIndex(
              x => x.conversationId === conversationId
            );
            const foundStory = stories[storyIndex];

            if (foundStory) {
              setStoriesToView({
                conversationId,
                stories: foundStory.stories,
              });
            }
          }}
          openConversationInternal={openConversationInternal}
          stories={stories}
          toggleHideStories={toggleHideStories}
        />
      </div>
      <div className="Stories__placeholder">
        <div className="Stories__placeholder__stories" />
        {i18n('Stories__placeholder--text')}
      </div>
    </div>
  );
};
