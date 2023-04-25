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
import type { ShowToastAction } from '../state/ducks/toast';
import type {
  AddStoryData,
  ViewUserStoriesActionCreatorType,
  ViewStoryActionCreatorType,
} from '../state/ducks/stories';
import { MyStories } from './MyStories';
import { StoriesPane } from './StoriesPane';
import { Theme, themeClassName } from '../util/theme';
import { getWidthFromPreferredWidth } from '../util/leftPaneWidth';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

export type PropsType = {
  addStoryData: AddStoryData;
  deleteStoryForEveryone: (story: StoryViewType) => unknown;
  getPreferredBadge: PreferredBadgeSelectorType;
  hasViewReceiptSetting: boolean;
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  isStoriesSettingsVisible: boolean;
  isViewingStory: boolean;
  maxAttachmentSizeInKb: number;
  me: ConversationType;
  myStories: Array<MyStoryType>;
  onForwardStory: (storyId: string) => unknown;
  onSaveStory: (story: StoryViewType) => unknown;
  onMediaPlaybackStart: () => void;
  preferredWidthFromStorage: number;
  queueStoryDownload: (storyId: string) => unknown;
  renderStoryCreator: () => JSX.Element;
  retryMessageSend: (messageId: string) => unknown;
  setAddStoryData: (data: AddStoryData) => unknown;
  showConversation: ShowConversationType;
  showStoriesSettings: () => unknown;
  showToast: ShowToastAction;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
  toggleStoriesView: () => unknown;
  viewStory: ViewStoryActionCreatorType;
  viewUserStories: ViewUserStoriesActionCreatorType;
};

export const STORIES_COLOR_THEME = Theme.Dark;

export function Stories({
  addStoryData,
  deleteStoryForEveryone,
  getPreferredBadge,
  hasViewReceiptSetting,
  hiddenStories,
  i18n,
  isStoriesSettingsVisible,
  isViewingStory,
  maxAttachmentSizeInKb,
  me,
  myStories,
  onForwardStory,
  onSaveStory,
  onMediaPlaybackStart,
  preferredWidthFromStorage,
  queueStoryDownload,
  renderStoryCreator,
  retryMessageSend,
  setAddStoryData,
  showConversation,
  showStoriesSettings,
  showToast,
  stories,
  toggleHideStories,
  toggleStoriesView,
  viewStory,
  viewUserStories,
}: PropsType): JSX.Element {
  const width = getWidthFromPreferredWidth(preferredWidthFromStorage, {
    requiresFullWidth: true,
  });

  const [isMyStories, setIsMyStories] = useState(false);

  // only handle ESC if not showing a child that handles their own ESC
  useEscapeHandling(
    (isMyStories && myStories.length) ||
      isViewingStory ||
      isStoriesSettingsVisible ||
      addStoryData
      ? undefined
      : toggleStoriesView
  );

  return (
    <div className={classNames('Stories', themeClassName(STORIES_COLOR_THEME))}>
      {addStoryData && renderStoryCreator()}
      <div className="Stories__pane" style={{ width }}>
        {isMyStories && myStories.length ? (
          <MyStories
            hasViewReceiptSetting={hasViewReceiptSetting}
            i18n={i18n}
            myStories={myStories}
            onBack={() => setIsMyStories(false)}
            onDelete={deleteStoryForEveryone}
            onForward={onForwardStory}
            onSave={onSaveStory}
            onMediaPlaybackStart={onMediaPlaybackStart}
            queueStoryDownload={queueStoryDownload}
            retryMessageSend={retryMessageSend}
            viewStory={viewStory}
          />
        ) : (
          <StoriesPane
            getPreferredBadge={getPreferredBadge}
            hiddenStories={hiddenStories}
            i18n={i18n}
            maxAttachmentSizeInKb={maxAttachmentSizeInKb}
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
            onMediaPlaybackStart={onMediaPlaybackStart}
            queueStoryDownload={queueStoryDownload}
            showConversation={showConversation}
            showToast={showToast}
            stories={stories}
            toggleHideStories={toggleHideStories}
            toggleStoriesView={toggleStoriesView}
            viewUserStories={viewUserStories}
          />
        )}
      </div>
      <div className="Stories__placeholder">
        <div className="Stories__placeholder__stories" />
        {i18n('icu:Stories__placeholder--text')}
      </div>
    </div>
  );
}
