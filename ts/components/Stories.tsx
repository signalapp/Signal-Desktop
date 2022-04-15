// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import FocusTrap from 'focus-trap-react';
import React, { useState } from 'react';
import classNames from 'classnames';
import type { ConversationStoryType } from './StoryListItem';
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
  queueStoryDownload: (storyId: string) => unknown;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
  toggleStoriesView: () => unknown;
};

export const Stories = ({
  hiddenStories,
  i18n,
  openConversationInternal,
  preferredWidthFromStorage,
  queueStoryDownload,
  renderStoryViewer,
  stories,
  toggleHideStories,
  toggleStoriesView,
}: PropsType): JSX.Element => {
  const [conversationIdToView, setConversationIdToView] = useState<
    undefined | string
  >();

  const width = getWidthFromPreferredWidth(preferredWidthFromStorage, {
    requiresFullWidth: true,
  });

  return (
    <div className={classNames('Stories', themeClassName(Theme.Dark))}>
      {conversationIdToView &&
        renderStoryViewer({
          conversationId: conversationIdToView,
          onClose: () => setConversationIdToView(undefined),
          onNextUserStories: () => {
            const storyIndex = stories.findIndex(
              x => x.conversationId === conversationIdToView
            );
            if (storyIndex >= stories.length - 1) {
              setConversationIdToView(undefined);
              return;
            }
            const nextStory = stories[storyIndex + 1];
            setConversationIdToView(nextStory.conversationId);
          },
          onPrevUserStories: () => {
            const storyIndex = stories.findIndex(
              x => x.conversationId === conversationIdToView
            );
            if (storyIndex === 0) {
              setConversationIdToView(undefined);
              return;
            }
            const prevStory = stories[storyIndex - 1];
            setConversationIdToView(prevStory.conversationId);
          },
        })}
      <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
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
                setConversationIdToView(conversationId);
              }
            }}
            openConversationInternal={openConversationInternal}
            queueStoryDownload={queueStoryDownload}
            stories={stories}
            toggleHideStories={toggleHideStories}
          />
        </div>
      </FocusTrap>
      <div className="Stories__placeholder">
        <div className="Stories__placeholder__stories" />
        {i18n('Stories__placeholder--text')}
      </div>
    </div>
  );
};
