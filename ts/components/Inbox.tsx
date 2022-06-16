// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect, useRef, useState } from 'react';

import type { ConversationModel } from '../models/conversations';
import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations';
import type { ConversationView } from '../views/conversation_view';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { SafetyNumberProps } from './SafetyNumberChangeDialog';

import * as log from '../logging/log';
import { SECOND } from '../util/durations';
import { SafetyNumberChangeDialog } from './SafetyNumberChangeDialog';
import { ToastStickerPackInstallFailed } from './ToastStickerPackInstallFailed';
import { WhatsNewLink } from './WhatsNewLink';
import { showToast } from '../util/showToast';
import { strictAssert } from '../util/assert';

export type PropsType = {
  cancelConversationVerification: () => void;
  conversationsStoppingSend: Array<ConversationType>;
  hasInitialLoadCompleted: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  isCustomizingPreferredReactions: boolean;
  renderCustomizingPreferredReactionsModal: () => JSX.Element;
  renderLeftPane: () => JSX.Element;
  renderSafetyNumber: (props: SafetyNumberProps) => JSX.Element;
  selectedConversationId?: string;
  selectedMessage?: string;
  showConversation: ShowConversationType;
  showWhatsNewModal: () => unknown;
  theme: ThemeType;
  verifyConversationsStoppingSend: () => void;
};

export const Inbox = ({
  cancelConversationVerification,
  conversationsStoppingSend,
  hasInitialLoadCompleted,
  getPreferredBadge,
  i18n,
  isCustomizingPreferredReactions,
  renderCustomizingPreferredReactionsModal,
  renderLeftPane,
  renderSafetyNumber,
  selectedConversationId,
  selectedMessage,
  showConversation,
  showWhatsNewModal,
  theme,
  verifyConversationsStoppingSend,
}: PropsType): JSX.Element => {
  const [loadingMessageCount, setLoadingMessageCount] = useState(0);
  const [internalHasInitialLoadCompleted, setInternalHasInitialLoadCompleted] =
    useState(hasInitialLoadCompleted);

  const conversationMountRef = useRef<HTMLDivElement | null>(null);
  const conversationViewRef = useRef<ConversationView | null>(null);

  const [prevConversation, setPrevConversation] = useState<
    ConversationModel | undefined
  >();

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const conversation = window.ConversationController.get(
      selectedConversationId
    );
    strictAssert(conversation, 'Conversation must be found');

    conversation.setMarkedUnread(false);

    if (!prevConversation || prevConversation.id !== selectedConversationId) {
      // We create a mount point because when calling .remove() on the Backbone
      // view it'll also remove the mount point along with it.
      const viewMountNode = document.createElement('div');
      conversationMountRef.current?.appendChild(viewMountNode);

      // Make sure to unload the previous conversation along with calling
      // Backbone's remove so that it is taken out of the DOM.
      if (prevConversation) {
        prevConversation.trigger('unload', 'opened another conversation');
      }
      conversationViewRef.current?.remove();

      // Can't import ConversationView directly because conversation_view
      // needs access to window.Signal first.
      const view = new window.Whisper.ConversationView({
        el: viewMountNode,
        model: conversation,
      });
      conversationViewRef.current = view;

      setPrevConversation(conversation);

      conversation.trigger('opened', selectedMessage);
    } else if (selectedMessage) {
      conversation.trigger('scroll-to-message', selectedMessage);
    }

    // Make sure poppers are positioned properly
    window.dispatchEvent(new Event('resize'));
  }, [prevConversation, selectedConversationId, selectedMessage]);

  // Whenever the selectedConversationId is cleared we should also ensure
  // that prevConversation is cleared too.
  useEffect(() => {
    if (prevConversation && !selectedConversationId) {
      setPrevConversation(undefined);
    }
  }, [prevConversation, selectedConversationId]);

  useEffect(() => {
    function refreshConversation({
      newId,
      oldId,
    }: {
      newId: string;
      oldId: string;
    }) {
      if (prevConversation && prevConversation.get('id') === oldId) {
        showConversation({ conversationId: newId });
      }
    }

    // Close current opened conversation to reload the group information once
    // linked.
    function unload() {
      if (!prevConversation) {
        return;
      }
      prevConversation.trigger('unload', 'force unload requested');
    }

    function onShowConversation(id: string, messageId?: string): void {
      showConversation({ conversationId: id, messageId });
    }

    function packInstallFailed() {
      showToast(ToastStickerPackInstallFailed);
    }

    window.Whisper.events.on('loadingProgress', setLoadingMessageCount);
    window.Whisper.events.on('pack-install-failed', packInstallFailed);
    window.Whisper.events.on('refreshConversation', refreshConversation);
    window.Whisper.events.on('setupAsNewDevice', unload);
    window.Whisper.events.on('showConversation', onShowConversation);

    return () => {
      window.Whisper.events.off('loadingProgress', setLoadingMessageCount);
      window.Whisper.events.off('pack-install-failed', packInstallFailed);
      window.Whisper.events.off('refreshConversation', refreshConversation);
      window.Whisper.events.off('setupAsNewDevice', unload);
      window.Whisper.events.off('showConversation', onShowConversation);
    };
  }, [prevConversation, showConversation]);

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
        </div>
      </div>
    );
  }

  let activeModal: ReactNode;
  if (conversationsStoppingSend.length) {
    activeModal = (
      <SafetyNumberChangeDialog
        confirmText={i18n('safetyNumberChangeDialog__pending-messages')}
        contacts={conversationsStoppingSend}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        onCancel={cancelConversationVerification}
        onConfirm={verifyConversationsStoppingSend}
        renderSafetyNumber={renderSafetyNumber}
        theme={theme}
      />
    );
  }
  if (!activeModal && isCustomizingPreferredReactions) {
    activeModal = renderCustomizingPreferredReactionsModal();
  }

  return (
    <>
      <div className="Inbox">
        <div className="module-title-bar-drag-area" />

        <div className="left-pane-wrapper">{renderLeftPane()}</div>

        <div className="conversation-stack">
          <div id="toast" />
          <div className="conversation" ref={conversationMountRef} />
          {!prevConversation && (
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
};
