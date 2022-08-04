// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import classNames from 'classnames';
import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations';
import type {
  ConversationStoryType,
  MyStoryType,
  StoryViewType,
} from '../types/Stories';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { PropsType as SmartStoryCreatorPropsType } from '../state/smart/StoryCreator';
import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import { MyStories } from './MyStories';
import { StoriesPane } from './StoriesPane';
import { Theme, themeClassName } from '../util/theme';
import { getWidthFromPreferredWidth } from '../util/leftPaneWidth';

export type PropsType = {
  deleteStoryForEveryone: (story: StoryViewType) => unknown;
  getPreferredBadge: PreferredBadgeSelectorType;
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  me: ConversationType;
  myStories: Array<MyStoryType>;
  onForwardStory: (storyId: string) => unknown;
  onSaveStory: (story: StoryViewType) => unknown;
  preferredWidthFromStorage: number;
  queueStoryDownload: (storyId: string) => unknown;
  renderStoryCreator: (props: SmartStoryCreatorPropsType) => JSX.Element;
  showConversation: ShowConversationType;
  showStoriesSettings: () => unknown;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
  toggleStoriesView: () => unknown;
  viewUserStories: (conversationId: string) => unknown;
  viewStory: ViewStoryActionCreatorType;
};

type AddStoryType =
  | {
      type: 'Media';
      file: File;
    }
  | { type: 'Text' }
  | undefined;

export const Stories = ({
  deleteStoryForEveryone,
  getPreferredBadge,
  hiddenStories,
  i18n,
  me,
  myStories,
  onForwardStory,
  onSaveStory,
  preferredWidthFromStorage,
  queueStoryDownload,
  renderStoryCreator,
  showConversation,
  showStoriesSettings,
  stories,
  toggleHideStories,
  toggleStoriesView,
  viewUserStories,
  viewStory,
}: PropsType): JSX.Element => {
  const width = getWidthFromPreferredWidth(preferredWidthFromStorage, {
    requiresFullWidth: true,
  });

  const [addStoryData, setAddStoryData] = useState<AddStoryType>();
  const [isMyStories, setIsMyStories] = useState(false);

  return (
    <div className={classNames('Stories', themeClassName(Theme.Dark))}>
      {addStoryData &&
        renderStoryCreator({
          file: addStoryData.type === 'Media' ? addStoryData.file : undefined,
          onClose: () => setAddStoryData(undefined),
        })}
      <div className="Stories__pane" style={{ width }}>
        {isMyStories && myStories.length ? (
          <MyStories
            i18n={i18n}
            myStories={myStories}
            onBack={() => setIsMyStories(false)}
            onDelete={deleteStoryForEveryone}
            onForward={onForwardStory}
            onSave={onSaveStory}
            queueStoryDownload={queueStoryDownload}
            viewStory={viewStory}
          />
        ) : (
          <StoriesPane
            getPreferredBadge={getPreferredBadge}
            hiddenStories={hiddenStories}
            i18n={i18n}
            me={me}
            myStories={myStories}
            onAddStory={file =>
              file
                ? setAddStoryData({ type: 'Media', file })
                : setAddStoryData({ type: 'Text' })
            }
            onMyStoriesClicked={() => {
              if (myStories.length) {
                setIsMyStories(true);
              } else {
                setAddStoryData({ type: 'Text' });
              }
            }}
            onStoriesSettings={showStoriesSettings}
            queueStoryDownload={queueStoryDownload}
            showConversation={showConversation}
            stories={stories}
            toggleHideStories={toggleHideStories}
            toggleStoriesView={toggleStoriesView}
            viewUserStories={viewUserStories}
          />
        )}
      </div>
      <div className="Stories__placeholder">
        <div className="Stories__placeholder__stories" />
        {i18n('Stories__placeholder--text')}
      </div>
    </div>
  );
};
