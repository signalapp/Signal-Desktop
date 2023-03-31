// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useEffect, useState, useMemo } from 'react';

import type { ShowConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';

import * as log from '../logging/log';
import { SECOND, DAY } from '../util/durations';
import { ToastStickerPackInstallFailed } from './ToastStickerPackInstallFailed';
import { WhatsNewLink } from './WhatsNewLink';
import { showToast } from '../util/showToast';
import { strictAssert } from '../util/assert';
import { TargetedMessageSource } from '../state/ducks/conversationsEnums';
import { usePrevious } from '../hooks/usePrevious';

export type PropsType = {
  firstEnvelopeTimestamp: number | undefined;
  envelopeTimestamp: number | undefined;
  hasInitialLoadCompleted: boolean;
  i18n: LocalizerType;
  isCustomizingPreferredReactions: boolean;
  onConversationClosed: (id: string, reason: string) => unknown;
  onConversationOpened: (id: string, messageId?: string) => unknown;
  renderConversationView: () => JSX.Element;
  renderCustomizingPreferredReactionsModal: () => JSX.Element;
  renderLeftPane: () => JSX.Element;
  renderMiniPlayer: (options: { shouldFlow: boolean }) => JSX.Element;
  scrollToMessage: (conversationId: string, messageId: string) => unknown;
  selectedConversationId?: string;
  targetedMessage?: string;
  targetedMessageSource?: TargetedMessageSource;
  showConversation: ShowConversationType;
  showWhatsNewModal: () => unknown;
};

export function Inbox({
  firstEnvelopeTimestamp,
  envelopeTimestamp,
  hasInitialLoadCompleted,
  i18n,
  isCustomizingPreferredReactions,
  onConversationClosed,
  onConversationOpened,
  renderConversationView,
  renderCustomizingPreferredReactionsModal,
  renderLeftPane,
  renderMiniPlayer,
  scrollToMessage,
  selectedConversationId,
  targetedMessage,
  targetedMessageSource,
  showConversation,
  showWhatsNewModal,
}: PropsType): JSX.Element {
  const [internalHasInitialLoadCompleted, setInternalHasInitialLoadCompleted] =
    useState(hasInitialLoadCompleted);

  const prevConversationId = usePrevious(
    selectedConversationId,
    selectedConversationId
  );

  const now = useMemo(() => Date.now(), []);
  const midnight = useMemo(() => {
    const date = new Date(now);
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.getTime();
  }, [now]);

  useEffect(() => {
    if (prevConversationId !== selectedConversationId) {
      if (prevConversationId) {
        onConversationClosed(prevConversationId, 'opened another conversation');
      }

      if (selectedConversationId) {
        onConversationOpened(selectedConversationId, targetedMessage);
      }
    } else if (
      selectedConversationId &&
      targetedMessage &&
      targetedMessageSource !== TargetedMessageSource.Focus
    ) {
      scrollToMessage(selectedConversationId, targetedMessage);
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
    targetedMessage,
    targetedMessageSource,
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

    window.Whisper.events.on('pack-install-failed', packInstallFailed);
    window.Whisper.events.on('refreshConversation', refreshConversation);
    window.Whisper.events.on('setupAsNewDevice', unload);

    return () => {
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
    let loadingProgress = 0;
    if (
      firstEnvelopeTimestamp !== undefined &&
      envelopeTimestamp !== undefined
    ) {
      loadingProgress =
        Math.max(
          0,
          Math.min(
            1,
            Math.max(0, envelopeTimestamp - firstEnvelopeTimestamp) /
              Math.max(1e-23, now - firstEnvelopeTimestamp)
          )
        ) * 100;
    }

    let message: string | undefined;
    if (envelopeTimestamp !== undefined) {
      const daysBeforeMidnight = Math.ceil(
        (midnight - envelopeTimestamp) / DAY
      );

      if (daysBeforeMidnight <= 0) {
        message = i18n('icu:loadingMessages--today');
      } else if (daysBeforeMidnight === 1) {
        message = i18n('icu:loadingMessages--yesterday');
      } else {
        message = i18n('icu:loadingMessages--other', {
          daysAgo: daysBeforeMidnight,
        });
      }
    }

    return (
      <div className="app-loading-screen">
        <div className="module-title-bar-drag-area" />

        <div className="module-splash-screen__logo module-img--150" />
        {envelopeTimestamp === undefined ? (
          <div className="container">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        ) : (
          <div className="app-loading-screen__progress--container">
            <div
              className="app-loading-screen__progress--bar"
              style={{ transform: `translateX(${loadingProgress - 100}%)` }}
            />
          </div>
        )}
        {message === undefined ? (
          <div className="message-placeholder" />
        ) : (
          <div className="message">{message}</div>
        )}
        <div id="toast" />
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
              {renderMiniPlayer({ shouldFlow: false })}
              <div className="module-splash-screen__logo module-img--128 module-logo-blue" />
              <h3>{i18n('icu:welcomeToSignal')}</h3>
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
