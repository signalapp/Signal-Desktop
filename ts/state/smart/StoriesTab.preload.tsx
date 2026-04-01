// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { SmartStoryCreator } from './StoryCreator.preload.tsx';
import { renderToastManagerWithoutMegaphone } from './ToastManager.preload.tsx';
import { StoriesTab } from '../../components/StoriesTab.dom.tsx';
import { getMaximumOutgoingVideoSize } from '../../types/AttachmentSize.std.ts';
import { getValue, type ConfigKeyType } from '../../RemoteConfig.dom.ts';
import {
  getMe,
  getOtherTabsUnreadStats,
} from '../selectors/conversations.dom.ts';
import { getIntl, getTheme } from '../selectors/user.std.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import {
  getHasStoryViewReceiptSetting,
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
  getRemoteConfig,
} from '../selectors/items.dom.ts';
import {
  getAddStoryData,
  getHasAnyFailedStorySends,
  getSelectedStoryData,
  getStories,
} from '../selectors/stories.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useStoriesActions } from '../ducks/stories.preload.ts';
import { useToastActions } from '../ducks/toast.preload.ts';
import { useAudioPlayerActions } from '../ducks/audioPlayer.preload.ts';
import { useItemsActions } from '../ducks/items.preload.ts';
import { getHasPendingUpdate } from '../selectors/updates.std.ts';

import { getIsStoriesSettingsVisible } from '../selectors/globalModals.std.ts';
import type { StoryViewType } from '../../types/Stories.std.ts';
import { ForwardMessagesModalType } from '../../components/ForwardMessagesModal.dom.tsx';

function renderStoryCreator(): React.JSX.Element {
  return <SmartStoryCreator />;
}

export const SmartStoriesTab = memo(function SmartStoriesTab() {
  const storiesActions = useStoriesActions();
  const {
    retryMessageSend,
    saveAttachment,
    showConversation,
    toggleHideStories,
  } = useConversationsActions();
  const { showStoriesSettings, toggleForwardMessagesModal } =
    useGlobalModalActions();
  const { showToast } = useToastActions();

  const i18n = useSelector(getIntl);
  const preferredWidthFromStorage = useSelector(getPreferredLeftPaneWidth);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const addStoryData = useSelector(getAddStoryData);
  const { hiddenStories, myStories, stories } = useSelector(getStories);
  const me = useSelector(getMe);
  const selectedStoryData = useSelector(getSelectedStoryData);
  const isStoriesSettingsVisible = useSelector(getIsStoriesSettingsVisible);
  const hasViewReceiptSetting = useSelector(getHasStoryViewReceiptSetting);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const remoteConfig = useSelector(getRemoteConfig);

  const maxAttachmentVideoSize = getMaximumOutgoingVideoSize(
    (name: ConfigKeyType) => getValue(name, remoteConfig)
  );
  const { pauseVoiceNotePlayer } = useAudioPlayerActions();

  const preferredLeftPaneWidth = useSelector(getPreferredLeftPaneWidth);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();

  const theme = useSelector(getTheme);

  useEffect(() => {
    storiesActions.markStoriesTabViewed();
    return () => {
      storiesActions.clearStoriesTabState();
    };
  }, [storiesActions]);

  const handleForwardStory = useCallback(
    (messageId: string) => {
      toggleForwardMessagesModal({
        type: ForwardMessagesModalType.Forward,
        messageIds: [messageId],
      });
    },
    [toggleForwardMessagesModal]
  );

  const handleSaveStory = useCallback(
    (story: StoryViewType) => {
      if (story.attachment) {
        saveAttachment(story.attachment, story.timestamp);
      }
    },
    [saveAttachment]
  );

  return (
    <StoriesTab
      otherTabsUnreadStats={otherTabsUnreadStats}
      addStoryData={addStoryData}
      getPreferredBadge={getPreferredBadge}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      hiddenStories={hiddenStories}
      i18n={i18n}
      maxAttachmentVideoSize={maxAttachmentVideoSize}
      me={me}
      myStories={myStories}
      navTabsCollapsed={navTabsCollapsed}
      onForwardStory={handleForwardStory}
      onSaveStory={handleSaveStory}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      onMediaPlaybackStart={pauseVoiceNotePlayer}
      preferredLeftPaneWidth={preferredLeftPaneWidth}
      preferredWidthFromStorage={preferredWidthFromStorage}
      renderStoryCreator={renderStoryCreator}
      renderToastManager={renderToastManagerWithoutMegaphone}
      retryMessageSend={retryMessageSend}
      savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      showConversation={showConversation}
      showStoriesSettings={showStoriesSettings}
      showToast={showToast}
      stories={stories}
      theme={theme}
      toggleHideStories={toggleHideStories}
      isViewingStory={selectedStoryData !== undefined}
      isStoriesSettingsVisible={isStoriesSettingsVisible}
      hasViewReceiptSetting={hasViewReceiptSetting}
      {...storiesActions}
    />
  );
});
