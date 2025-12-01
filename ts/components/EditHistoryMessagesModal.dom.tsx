// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback, useState, useRef } from 'react';
import lodash from 'lodash';

import type { AttachmentType } from '../types/Attachment.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import type { MessagePropsType } from '../state/selectors/message.preload.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import {
  Message,
  MessageInteractivity,
  TextDirection,
} from './conversation/Message.dom.js';
import { Modal } from './Modal.dom.js';
import { WidthBreakpoint } from './_util.std.js';
import { shouldNeverBeCalled } from '../util/shouldNeverBeCalled.std.js';
import { useTheme } from '../hooks/useTheme.dom.js';
import { isSameDay } from '../util/timestamp.std.js';
import { TimelineDateHeader } from './conversation/TimelineDateHeader.dom.js';
import { AxoContextMenu } from '../axo/AxoContextMenu.dom.js';
import { drop } from '../util/drop.std.js';
import type { AxoMenuBuilder } from '../axo/AxoMenuBuilder.dom.js';

const { noop } = lodash;

export type PropsType = {
  closeEditHistoryModal: () => unknown;
  editHistoryMessages: Array<MessagePropsType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  platform: string;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  cancelAttachmentDownload: (options: { messageId: string }) => void;
  showLightbox: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
};

const MESSAGE_DEFAULT_PROPS = {
  canDeleteForEveryone: false,
  checkForAccount: shouldNeverBeCalled,
  clearSelectedMessage: shouldNeverBeCalled,
  clearTargetedMessage: shouldNeverBeCalled,
  containerWidthBreakpoint: WidthBreakpoint.Medium,
  doubleCheckMissingQuoteReference: shouldNeverBeCalled,
  interactionMode: 'mouse' as const,
  isBlocked: false,
  isMessageRequestAccepted: true,
  markAttachmentAsCorrupted: shouldNeverBeCalled,
  messageExpanded: shouldNeverBeCalled,
  onReplyToMessage: shouldNeverBeCalled,
  onToggleSelect: shouldNeverBeCalled,
  openGiftBadge: shouldNeverBeCalled,
  openLink: shouldNeverBeCalled,
  previews: [],
  retryMessageSend: shouldNeverBeCalled,
  sendPollVote: shouldNeverBeCalled,
  endPoll: shouldNeverBeCalled,
  pushPanelForConversation: shouldNeverBeCalled,
  renderAudioAttachment: () => <div />,
  renderingContext: 'EditHistoryMessagesModal' as const,
  saveAttachment: shouldNeverBeCalled,
  saveAttachments: shouldNeverBeCalled,
  scrollToQuotedMessage: shouldNeverBeCalled,
  shouldCollapseAbove: false,
  shouldCollapseBelow: false,
  shouldHideMetadata: false,
  showContactModal: shouldNeverBeCalled,
  showConversation: noop,
  showEditHistoryModal: noop,
  showAttachmentDownloadStillInProgressToast: shouldNeverBeCalled,
  showExpiredIncomingTapToViewToast: shouldNeverBeCalled,
  showExpiredOutgoingTapToViewToast: shouldNeverBeCalled,
  showLightboxForViewOnceMedia: shouldNeverBeCalled,
  showMediaNoLongerAvailableToast: shouldNeverBeCalled,
  showTapToViewNotAvailableModal: shouldNeverBeCalled,
  startConversation: shouldNeverBeCalled,
  textDirection: TextDirection.Default,
  viewStory: shouldNeverBeCalled,
};

export function EditHistoryMessagesModal({
  cancelAttachmentDownload,
  closeEditHistoryModal,
  getPreferredBadge,
  editHistoryMessages,
  i18n,
  platform,
  kickOffAttachmentDownload,
  showLightbox,
}: PropsType): JSX.Element {
  const containerElementRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  const closeAndShowLightbox = useCallback(
    (options: { attachment: AttachmentType; messageId: string }) => {
      closeEditHistoryModal();
      showLightbox(options);
    },
    [closeEditHistoryModal, showLightbox]
  );

  // These states aren't in redux; they are meant to last only as long as this dialog.
  const [revealedSpoilersById, setRevealedSpoilersById] = useState<
    Record<string, Record<number, boolean> | undefined>
  >({});
  const [displayLimitById, setDisplayLimitById] = useState<
    Record<string, number | undefined>
  >({});

  const [currentMessage, ...pastEdits] = editHistoryMessages;
  const currentMessageId = `${currentMessage.id}.${currentMessage.timestamp}`;

  let previousItem = currentMessage;

  return (
    <Modal
      hasXButton
      i18n={i18n}
      modalName="EditHistoryMessagesModal"
      moduleClassName="EditHistoryMessagesModal"
      onClose={closeEditHistoryModal}
      noTransform
    >
      <div ref={containerElementRef}>
        <TimelineDateHeader i18n={i18n} timestamp={currentMessage.timestamp} />
        <Message
          {...MESSAGE_DEFAULT_PROPS}
          {...currentMessage}
          id={currentMessageId}
          containerElementRef={containerElementRef}
          displayLimit={displayLimitById[currentMessageId]}
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          interactivity={MessageInteractivity.Static}
          isEditedMessage
          isSpoilerExpanded={revealedSpoilersById[currentMessageId] || {}}
          key={currentMessage.timestamp}
          kickOffAttachmentDownload={() =>
            kickOffAttachmentDownload({ messageId: currentMessage.id })
          }
          cancelAttachmentDownload={() =>
            cancelAttachmentDownload({ messageId: currentMessage.id })
          }
          messageExpanded={(messageId, displayLimit) => {
            const update = {
              ...displayLimitById,
              [messageId]: displayLimit,
            };
            setDisplayLimitById(update);
          }}
          platform={platform}
          showLightbox={closeAndShowLightbox}
          showSpoiler={(messageId, data) => {
            const update = {
              ...revealedSpoilersById,
              [messageId]: data,
            };
            setRevealedSpoilersById(update);
          }}
          theme={theme}
          renderMessageContextMenu={(
            _renderer: AxoMenuBuilder.Renderer,
            children
          ) => {
            return (
              <EditHistoryMessageContextMenu
                i18n={i18n}
                timestamp={currentMessage.timestamp}
              >
                {children}
              </EditHistoryMessageContextMenu>
            );
          }}
        />

        <hr className="EditHistoryMessagesModal__divider" />

        <h3 className="EditHistoryMessagesModal__title">
          {i18n('icu:EditHistoryMessagesModal__title')}
        </h3>

        {pastEdits.map(messageAttributes => {
          const syntheticId = `${messageAttributes.id}.${messageAttributes.timestamp}`;

          const shouldShowDateHeader = Boolean(
            !previousItem ||
              // This comparison avoids strange header behavior for out-of-order messages.
              (messageAttributes.timestamp > previousItem.timestamp &&
                !isSameDay(previousItem.timestamp, messageAttributes.timestamp))
          );
          const dateHeaderElement = shouldShowDateHeader ? (
            <TimelineDateHeader
              i18n={i18n}
              timestamp={messageAttributes.timestamp}
            />
          ) : null;

          previousItem = messageAttributes;

          return (
            <React.Fragment key={messageAttributes.timestamp}>
              {dateHeaderElement}
              <Message
                {...MESSAGE_DEFAULT_PROPS}
                {...messageAttributes}
                id={syntheticId}
                interactivity={MessageInteractivity.Static}
                containerElementRef={containerElementRef}
                displayLimit={displayLimitById[syntheticId]}
                getPreferredBadge={getPreferredBadge}
                i18n={i18n}
                isSpoilerExpanded={revealedSpoilersById[syntheticId] || {}}
                kickOffAttachmentDownload={() =>
                  kickOffAttachmentDownload({ messageId: currentMessage.id })
                }
                cancelAttachmentDownload={() =>
                  cancelAttachmentDownload({ messageId: currentMessage.id })
                }
                messageExpanded={(messageId, displayLimit) => {
                  const update = {
                    ...displayLimitById,
                    [messageId]: displayLimit,
                  };
                  setDisplayLimitById(update);
                }}
                platform={platform}
                showLightbox={closeAndShowLightbox}
                showSpoiler={(messageId, data) => {
                  const update = {
                    ...revealedSpoilersById,
                    [messageId]: data,
                  };
                  setRevealedSpoilersById(update);
                }}
                theme={theme}
                renderMessageContextMenu={(
                  _renderer: AxoMenuBuilder.Renderer,
                  children
                ) => {
                  return (
                    <EditHistoryMessageContextMenu
                      i18n={i18n}
                      timestamp={messageAttributes.timestamp}
                    >
                      {children}
                    </EditHistoryMessageContextMenu>
                  );
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
    </Modal>
  );
}

function EditHistoryMessageContextMenu(props: {
  i18n: LocalizerType;
  timestamp: number;
  children: ReactNode;
}) {
  const { i18n, timestamp } = props;

  const onCopyTimestamp = useCallback(() => {
    drop(window.navigator.clipboard.writeText(`${timestamp}`));
  }, [timestamp]);

  return (
    <AxoContextMenu.Root>
      <AxoContextMenu.Trigger>{props.children}</AxoContextMenu.Trigger>
      <AxoContextMenu.Content>
        <AxoContextMenu.Item symbol="copy" onSelect={onCopyTimestamp}>
          {i18n(
            'icu:EditHistoryMessagesModal__Message__ContextMenu__CopyTimestamp'
          )}
        </AxoContextMenu.Item>
      </AxoContextMenu.Content>
    </AxoContextMenu.Root>
  );
}
