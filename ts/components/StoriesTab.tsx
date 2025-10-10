// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations.js';
import type {
  ConversationStoryType,
  MyStoryType,
  StoryViewType,
} from '../types/Stories.js';
import type { LocalizerType, ThemeType } from '../types/Util.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.js';
import type { ShowToastAction } from '../state/ducks/toast.js';
import type {
  AddStoryData,
  ViewUserStoriesActionCreatorType,
  ViewStoryActionCreatorType,
} from '../state/ducks/stories.js';
import { MyStories } from './MyStories.js';
import { StoriesPane } from './StoriesPane.js';
import { NavSidebar, NavSidebarActionButton } from './NavSidebar.js';
import { StoriesAddStoryButton } from './StoriesAddStoryButton.js';
import { I18n } from './I18n.js';
import type { WidthBreakpoint } from './_util.js';
import type { UnreadStats } from '../util/countUnreadStats.js';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.js';

export type PropsType = {
  addStoryData: AddStoryData;
  otherTabsUnreadStats: UnreadStats;
  deleteStoryForEveryone: (story: StoryViewType) => unknown;
  getPreferredBadge: PreferredBadgeSelectorType;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  hasViewReceiptSetting: boolean;
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  isStoriesSettingsVisible: boolean;
  isViewingStory: boolean;
  maxAttachmentSizeInKb: number;
  me: ConversationType;
  myStories: Array<MyStoryType>;
  navTabsCollapsed: boolean;
  onForwardStory: (storyId: string) => unknown;
  onSaveStory: (story: StoryViewType) => unknown;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  onMediaPlaybackStart: () => void;
  preferredLeftPaneWidth: number;
  preferredWidthFromStorage: number;
  queueStoryDownload: (storyId: string) => unknown;
  renderStoryCreator: () => JSX.Element;
  renderToastManager: (_: {
    containerWidthBreakpoint: WidthBreakpoint;
  }) => JSX.Element;
  retryMessageSend: (messageId: string) => unknown;
  savePreferredLeftPaneWidth: (preferredLeftPaneWidth: number) => void;
  setAddStoryData: (data: AddStoryData) => unknown;
  showConversation: ShowConversationType;
  showStoriesSettings: () => unknown;
  showToast: ShowToastAction;
  stories: Array<ConversationStoryType>;
  theme: ThemeType;
  toggleHideStories: (conversationId: string) => unknown;
  viewStory: ViewStoryActionCreatorType;
  viewUserStories: ViewUserStoriesActionCreatorType;
};

export function StoriesTab({
  addStoryData,
  otherTabsUnreadStats,
  deleteStoryForEveryone,
  getPreferredBadge,
  hasFailedStorySends,
  hasPendingUpdate,
  hasViewReceiptSetting,
  hiddenStories,
  i18n,
  maxAttachmentSizeInKb,
  me,
  myStories,
  navTabsCollapsed,
  onForwardStory,
  onSaveStory,
  onToggleNavTabsCollapse,
  onMediaPlaybackStart,
  preferredLeftPaneWidth,
  queueStoryDownload,
  renderStoryCreator,
  renderToastManager,
  retryMessageSend,
  savePreferredLeftPaneWidth,
  setAddStoryData,
  showConversation,
  showStoriesSettings,
  showToast,
  stories,
  theme,
  toggleHideStories,
  viewStory,
  viewUserStories,
}: PropsType): JSX.Element {
  const [isMyStories, setIsMyStories] = useState(false);

  function onAddStory(file?: File) {
    if (file) {
      setAddStoryData({ type: 'Media', file });
    } else {
      setAddStoryData({ type: 'Text' });
    }
  }

  return (
    <div className="Stories">
      {addStoryData && renderStoryCreator()}
      {isMyStories && myStories.length ? (
        <MyStories
          otherTabsUnreadStats={otherTabsUnreadStats}
          hasFailedStorySends={hasFailedStorySends}
          hasPendingUpdate={hasPendingUpdate}
          hasViewReceiptSetting={hasViewReceiptSetting}
          i18n={i18n}
          myStories={myStories}
          navTabsCollapsed={navTabsCollapsed}
          onBack={() => setIsMyStories(false)}
          onDelete={deleteStoryForEveryone}
          onForward={onForwardStory}
          onSave={onSaveStory}
          onMediaPlaybackStart={onMediaPlaybackStart}
          onToggleNavTabsCollapse={onToggleNavTabsCollapse}
          preferredLeftPaneWidth={preferredLeftPaneWidth}
          queueStoryDownload={queueStoryDownload}
          retryMessageSend={retryMessageSend}
          renderToastManager={renderToastManager}
          savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
          theme={theme}
          viewStory={viewStory}
        />
      ) : (
        <NavSidebar
          title={i18n('icu:Stories__title')}
          i18n={i18n}
          hasFailedStorySends={hasFailedStorySends}
          hasPendingUpdate={hasPendingUpdate}
          navTabsCollapsed={navTabsCollapsed}
          onToggleNavTabsCollapse={onToggleNavTabsCollapse}
          preferredLeftPaneWidth={preferredLeftPaneWidth}
          requiresFullWidth
          savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
          otherTabsUnreadStats={otherTabsUnreadStats}
          renderToastManager={renderToastManager}
          actions={
            <>
              <StoriesAddStoryButton
                i18n={i18n}
                maxAttachmentSizeInKb={maxAttachmentSizeInKb}
                moduleClassName="Stories__pane__add-story"
                onAddStory={onAddStory}
                showToast={showToast}
              />
              <AxoDropdownMenu.Root>
                <AxoDropdownMenu.Trigger>
                  <NavSidebarActionButton
                    icon={<span className="StoriesTab__MoreActionsIcon" />}
                    label={i18n('icu:StoriesTab__MoreActionsLabel')}
                  />
                </AxoDropdownMenu.Trigger>
                <AxoDropdownMenu.Content>
                  <AxoDropdownMenu.Item
                    symbol="lock"
                    onSelect={showStoriesSettings}
                  >
                    {i18n('icu:StoriesSettings__context-menu')}
                  </AxoDropdownMenu.Item>
                </AxoDropdownMenu.Content>
              </AxoDropdownMenu.Root>
            </>
          }
        >
          <StoriesPane
            getPreferredBadge={getPreferredBadge}
            hiddenStories={hiddenStories}
            i18n={i18n}
            maxAttachmentSizeInKb={maxAttachmentSizeInKb}
            me={me}
            myStories={myStories}
            onAddStory={onAddStory}
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
            theme={theme}
            toggleHideStories={toggleHideStories}
            viewUserStories={viewUserStories}
          />
        </NavSidebar>
      )}
      <div className="Stories__placeholder">
        <div className="Stories__placeholder__icon" />
        <div className="Stories__placeholder__text">
          {stories.length ? (
            i18n('icu:Stories__placeholder--text')
          ) : (
            <I18n
              i18n={i18n}
              id="icu:Stories__placeholder-with-icon--text-2"
              components={{
                // eslint-disable-next-line react/no-unstable-nested-components
                newStoryButtonIcon: () => {
                  return (
                    <span
                      className="Stories__placeholder__text__action"
                      aria-label={i18n('icu:Stories__add')}
                    />
                  );
                },
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
