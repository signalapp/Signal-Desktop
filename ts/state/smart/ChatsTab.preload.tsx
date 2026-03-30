// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';

import { ChatsTab } from '../../components/ChatsTab.dom.tsx';
import type { SmartConversationViewProps } from './ConversationView.preload.tsx';
import { SmartConversationView } from './ConversationView.preload.tsx';
import { SmartMiniPlayer } from './MiniPlayer.preload.tsx';
import { SmartLeftPane } from './LeftPane.preload.tsx';
import type { NavTabPanelProps } from '../../components/NavTabs.dom.tsx';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getIntl } from '../selectors/user.std.ts';
import { TargetedMessageSource } from '../ducks/conversationsEnums.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useToastActions } from '../ducks/toast.preload.ts';
import { isStagingServer } from '../../util/isStagingServer.dom.ts';
import { ToastType } from '../../types/Toast.dom.tsx';
import { getNavTabsCollapsed } from '../selectors/items.dom.ts';
import { useItemsActions } from '../ducks/items.preload.ts';
import { getHasAnyFailedStorySends } from '../selectors/stories.preload.ts';
import { getHasPendingUpdate } from '../selectors/updates.std.ts';
import { getSelectedConversationId } from '../selectors/nav.std.ts';
import {
  getOtherTabsUnreadStats,
  getTargetedMessage,
  getTargetedMessageSource,
} from '../selectors/conversations.dom.ts';
import { useChatFolderActions } from '../ducks/chatFolders.preload.ts';
import { useComposerActions } from '../ducks/composer.preload.ts';

function renderConversationView(props: SmartConversationViewProps) {
  return <SmartConversationView {...props} />;
}

function renderLeftPane(props: NavTabPanelProps) {
  return <SmartLeftPane {...props} />;
}

function renderMiniPlayer(options: { shouldFlow: boolean }) {
  return <SmartMiniPlayer {...options} />;
}

export const SmartChatsTab = memo(function SmartChatsTab() {
  const i18n = useSelector(getIntl);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const selectedConversationId = useSelector(getSelectedConversationId);
  const targetedMessageId = useSelector(getTargetedMessage)?.id;
  const targetedMessageSource = useSelector(getTargetedMessageSource);

  const { onConversationClosed, onConversationOpened, scrollToMessage } =
    useConversationsActions();
  const { showWhatsNewModal } = useGlobalModalActions();
  const { toggleNavTabsCollapse } = useItemsActions();
  const { showToast } = useToastActions();
  const { updateChatFolderStateOnTargetConversationChanged } =
    useChatFolderActions();
  const { saveDraftRecordingIfNeeded } = useComposerActions();

  const lastOpenedConversationId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (selectedConversationId !== lastOpenedConversationId.current) {
      if (lastOpenedConversationId.current) {
        saveDraftRecordingIfNeeded(lastOpenedConversationId.current);
        onConversationClosed(
          lastOpenedConversationId.current,
          'ChatsTab opened another chat'
        );
      }
      updateChatFolderStateOnTargetConversationChanged(selectedConversationId);

      lastOpenedConversationId.current = selectedConversationId;
      if (selectedConversationId) {
        onConversationOpened(
          selectedConversationId,
          targetedMessageId,
          targetedMessageSource
        );
      }
    } else if (
      selectedConversationId &&
      targetedMessageId &&
      targetedMessageSource === TargetedMessageSource.NavigateToMessage
    ) {
      scrollToMessage(selectedConversationId, targetedMessageId);
    }
  }, [
    onConversationClosed,
    onConversationOpened,
    scrollToMessage,
    selectedConversationId,
    saveDraftRecordingIfNeeded,
    targetedMessageId,
    targetedMessageSource,
    updateChatFolderStateOnTargetConversationChanged,
  ]);

  useEffect(() => {
    // Close current opened conversation to reload the group information once linked.
    function unload() {
      if (!lastOpenedConversationId.current) {
        return;
      }
      onConversationClosed(
        lastOpenedConversationId.current,
        'force unload requested'
      );
    }

    function packInstallFailed() {
      showToast({ toastType: ToastType.StickerPackInstallFailed });
    }

    window.Whisper.events.on('pack-install-failed', packInstallFailed);
    window.Whisper.events.on('setupAsNewDevice', unload);

    return () => {
      window.Whisper.events.off('pack-install-failed', packInstallFailed);
      window.Whisper.events.off('setupAsNewDevice', unload);
    };
  }, [onConversationClosed, showToast]);

  useEffect(() => {
    if (!selectedConversationId) {
      window.SignalCI?.handleEvent('empty-inbox:rendered', null);
    }
  }, [selectedConversationId]);

  return (
    <ChatsTab
      otherTabsUnreadStats={otherTabsUnreadStats}
      i18n={i18n}
      isStaging={isStagingServer()}
      hasFailedStorySends={hasFailedStorySends}
      hasPendingUpdate={hasPendingUpdate}
      navTabsCollapsed={navTabsCollapsed}
      onToggleNavTabsCollapse={toggleNavTabsCollapse}
      renderConversationView={renderConversationView}
      renderLeftPane={renderLeftPane}
      renderMiniPlayer={renderMiniPlayer}
      selectedConversationId={selectedConversationId}
      showWhatsNewModal={showWhatsNewModal}
    />
  );
});
