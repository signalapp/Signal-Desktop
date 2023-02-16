// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect, useState } from 'react';

import type { ShowConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';

import * as log from '../logging/log';
import { SECOND } from '../util/durations';
import { ToastStickerPackInstallFailed } from './ToastStickerPackInstallFailed';
import { WhatsNewLink } from './WhatsNewLink';
import { showToast } from '../util/showToast';
import { strictAssert } from '../util/assert';
import { SelectedMessageSource } from '../state/ducks/conversationsEnums';
import { usePrevious } from '../hooks/usePrevious';

export type PropsType = {
  hasInitialLoadCompleted: boolean;
  i18n: LocalizerType;
  isCustomizingPreferredReactions: boolean;
  onConversationClosed: (id: string, reason: string) => unknown;
  onConversationOpened: (id: string, messageId?: string) => unknown;
  renderConversationView: () => JSX.Element;
  renderCustomizingPreferredReactionsModal: () => JSX.Element;
  renderLeftPane: () => JSX.Element;
  scrollToMessage: (conversationId: string, messageId: string) => unknown;
  selectedConversationId?: string;
  selectedMessage?: string;
  selectedMessageSource?: SelectedMessageSource;
  showConversation: ShowConversationType;
  showWhatsNewModal: () => unknown;
};

export function Inbox({
  hasInitialLoadCompleted,
  i18n,
  isCustomizingPreferredReactions,
  onConversationClosed,
  onConversationOpened,
  renderConversationView,
  renderCustomizingPreferredReactionsModal,
  renderLeftPane,
  scrollToMessage,
  selectedConversationId,
  selectedMessage,
  selectedMessageSource,
  showConversation,
  showWhatsNewModal,
}: PropsType): JSX.Element {
  const [loadingMessageCount, setLoadingMessageCount] = useState(0);
  const [internalHasInitialLoadCompleted, setInternalHasInitialLoadCompleted] =
    useState(hasInitialLoadCompleted);

  const prevConversationId = usePrevious(
    selectedConversationId,
    selectedConversationId
  );

  useEffect(() => {
    if (prevConversationId !== selectedConversationId) {
      if (prevConversationId) {
        onConversationClosed(prevConversationId, 'opened another conversation');
      }

      if (selectedConversationId) {
        onConversationOpened(selectedConversationId, selectedMessage);
      }
    } else if (
      selectedConversationId &&
      selectedMessage &&
      selectedMessageSource !== SelectedMessageSource.Focus
    ) {
      scrollToMessage(selectedConversationId, selectedMessage);
    }

    if (!selectedConversationId) {
      return;
    }

    const conversation = window.ConversationController.get(
      selectedConversationId
    );
    strictAssert(conversation, 'Conversation must be found');

    conversation.setMarkedUnread(false);
  }, [
    onConversationClosed,
    onConversationOpened,
    prevConversationId,
    scrollToMessage,
    selectedConversationId,
    selectedMessage,
    selectedMessageSource,
  ]);

  useEffect(() => {
    function refreshConversation({
      newId,
      oldId,
    }: {
      newId: string;
      oldId: string;
    }) {
      if (prevConversationId === oldId) {
        showConversation({ conversationId: newId });
      }
    }

    // Close current opened conversation to reload the group information once
    // linked.
    function unload() {
      if (!prevConversationId) {
        return;
      }
      onConversationClosed(prevConversationId, 'force unload requested');
    }

    function packInstallFailed() {
      showToast(ToastStickerPackInstallFailed);
    }

    window.Whisper.events.on('loadingProgress', setLoadingMessageCount);
    window.Whisper.events.on('pack-install-failed', packInstallFailed);
    window.Whisper.events.on('refreshConversation', refreshConversation);
    window.Whisper.events.on('setupAsNewDevice', unload);

    return () => {
      window.Whisper.events.off('loadingProgress', setLoadingMessageCount);
      window.Whisper.events.off('pack-install-failed', packInstallFailed);
      window.Whisper.events.off('refreshConversation', refreshConversation);
      window.Whisper.events.off('setupAsNewDevice', unload);
    };
  }, [onConversationClosed, prevConversationId, showConversation]);

  useEffect(() => {
    if (internalHasInitialLoadCompleted) {
      return;
    }

    const interval = setInterval(() => {
      const status = window.getSocketStatus();
      switch (status) {
        case 'CONNECTING':
          break;
        case 'OPEN':
          // if we've connected, we can wait for real empty event
          clearInterval(interval);
          break;
        case 'CLOSING':
        case 'CLOSED':
          clearInterval(interval);
          // if we failed to connect, we pretend we loaded
          setInternalHasInitialLoadCompleted(true);
          break;
        default:
          log.warn(
            `startConnectionListener: Found unexpected socket status ${status}; setting load to done manually.`
          );
          setInternalHasInitialLoadCompleted(true);
          break;
      }
    }, SECOND);

    return () => {
      clearInterval(interval);
    };
  }, [internalHasInitialLoadCompleted]);

  useEffect(() => {
    setInternalHasInitialLoadCompleted(hasInitialLoadCompleted);
  }, [hasInitialLoadCompleted]);

  if (!internalHasInitialLoadCompleted) {
    return (
      <div className="app-loading-screen">
        <div className="module-title-bar-drag-area" />

        <div className="content">
          <div className="module-splash-screen__logo module-img--150" />
          <div className="container">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          <div className="message">
            {loadingMessageCount
              ? i18n('loadingMessages', [String(loadingMessageCount)])
              : i18n('loading')}
          </div>
          <div id="toast" />
        </div>
      </div>
    );
  }

  let activeModal: ReactNode;
  if (isCustomizingPreferredReactions) {
    activeModal = renderCustomizingPreferredReactionsModal();
  }

  return (
    <>
      <div className="Inbox">
        <div className="module-title-bar-drag-area" />

        <div className="left-pane-wrapper">{renderLeftPane()}</div>

        <div className="conversation-stack">
          <div id="toast" />
          {selectedConversationId && (
            <div
              className="conversation"
              id={`conversation-${selectedConversationId}`}
            >
              {renderConversationView()}
            </div>
          )}
          {!prevConversationId && (
            <div className="no-conversation-open">
              <div className="module-splash-screen__logo module-img--128 module-logo-blue" />
              <h3>{i18n('welcomeToSignal')}</h3>
              <p className="whats-new-placeholder">
                <WhatsNewLink
                  i18n={i18n}
                  showWhatsNewModal={showWhatsNewModal}
                />
              </p>
            </div>
          )}
        </div>
      </div>
      {activeModal}
    </>
  );
}
