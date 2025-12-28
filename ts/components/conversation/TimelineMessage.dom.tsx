// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import lodash from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow.js';
import { isDownloaded } from '../../util/Attachment.std.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import { handleOutsideClick } from '../../util/handleOutsideClick.dom.js';
import { offsetDistanceModifier } from '../../util/popperUtil.std.js';
import { WidthBreakpoint } from '../_util.std.js';
import { Message, MessageInteractivity } from './Message.dom.js';
import type { SmartReactionPicker } from '../../state/smart/ReactionPicker.dom.js';
import type {
  Props as MessageProps,
  PropsActions as MessagePropsActions,
  PropsData as MessagePropsData,
  PropsHousekeeping,
} from './Message.dom.js';
import type { PushPanelForConversationActionType } from '../../state/ducks/conversations.preload.js';
import { doesMessageBodyOverflow } from './MessageBodyReadMore.dom.js';
import { useToggleReactionPicker } from '../../hooks/useKeyboardShortcuts.dom.js';
import { PanelType } from '../../types/Panels.std.js';
import type {
  DeleteMessagesPropsType,
  ForwardMessagesPayload,
} from '../../state/ducks/globalModals.preload.js';
import { useScrollerLock } from '../../hooks/useScrollLock.dom.js';
import { MessageContextMenu } from './MessageContextMenu.dom.js';
import { ForwardMessagesModalType } from '../ForwardMessagesModal.dom.js';
import { useGroupedAndOrderedReactions } from '../../util/groupAndOrderReactions.dom.js';
import { isNotNil } from '../../util/isNotNil.std.js';
import type { AxoMenuBuilder } from '../../axo/AxoMenuBuilder.dom.js';
import { AxoContextMenu } from '../../axo/AxoContextMenu.dom.js';
import { PinMessageDialog } from './pinned-messages/PinMessageDialog.dom.js';
import type { DurationInSeconds } from '../../util/durations/duration-in-seconds.std.js';
import { useDocumentKeyDown } from '../../hooks/useDocumentKeyDown.dom.js';

const { useAxoContextMenuOutsideKeyboardTrigger } = AxoContextMenu;

const { noop } = lodash;

export type PropsData = {
  canDownload: boolean;
  canCopy: boolean;
  canEditMessage: boolean;
  canEndPoll: boolean;
  canForward: boolean;
  canRetry: boolean;
  canRetryDeleteForEveryone: boolean;
  canReact: boolean;
  canReply: boolean;
  canPinMessages: boolean;
  hasMaxPinnedMessages: boolean;
  selectedReaction?: string;
  isTargeted?: boolean;
} & Omit<MessagePropsData, 'renderingContext' | 'menu'>;

export type PropsActions = {
  onPinnedMessageAdd: (
    messageId: string,
    duration: DurationInSeconds | null
  ) => void;
  onPinnedMessageRemove: (messageId: string) => void;
  pushPanelForConversation: PushPanelForConversationActionType;
  toggleDeleteMessagesModal: (props: DeleteMessagesPropsType) => void;
  toggleForwardMessagesModal: (payload: ForwardMessagesPayload) => void;
  endPoll: (id: string) => void;
  reactToMessage: (
    id: string,
    { emoji, remove }: { emoji: string; remove: boolean }
  ) => void;
  retryMessageSend: (id: string) => void;
  sendPollVote: (params: {
    messageId: string;
    optionIndexes: ReadonlyArray<number>;
  }) => void;
  copyMessageText: (id: string) => void;
  retryDeleteForEveryone: (id: string) => void;
  setMessageToEdit: (conversationId: string, messageId: string) => unknown;
  setQuoteByMessageId: (conversationId: string, messageId: string) => void;
  toggleSelectMessage: (
    conversationId: string,
    messageId: string,
    shift: boolean,
    selected: boolean
  ) => void;
} & Omit<MessagePropsActions, 'onToggleSelect' | 'onReplyToMessage'>;

export type Props = PropsData &
  PropsActions &
  Omit<PropsHousekeeping, 'isAttachmentPending'> & {
    renderReactionPicker: (
      props: React.ComponentProps<typeof SmartReactionPicker>
    ) => JSX.Element;
  };

/**
 * Message with menu/context-menu (as necessary for rendering in the timeline)
 */
export function TimelineMessage(props: Props): JSX.Element {
  const {
    attachments,
    canDownload,
    canCopy,
    canEditMessage,
    canEndPoll,
    canForward,
    canReact,
    canReply,
    canRetry,
    canRetryDeleteForEveryone,
    canPinMessages,
    containerElementRef,
    containerWidthBreakpoint,
    conversationId,
    direction,
    hasMaxPinnedMessages,
    i18n,
    id,
    interactivity,
    isPinned,
    isTargeted,
    kickOffAttachmentDownload,
    copyMessageText,
    endPoll,
    onPinnedMessageAdd,
    onPinnedMessageRemove,
    pushPanelForConversation,
    reactToMessage,
    renderReactionPicker,
    retryDeleteForEveryone,
    retryMessageSend,
    saveAttachment,
    saveAttachments,
    showAttachmentDownloadStillInProgressToast,
    selectedReaction,
    setQuoteByMessageId,
    setMessageToEdit,
    text,
    timestamp,
    toggleDeleteMessagesModal,
    toggleForwardMessagesModal,
    toggleSelectMessage,
  } = props;

  const [reactionPickerRoot, setReactionPickerRoot] = useState<
    HTMLDivElement | undefined
  >(undefined);
  const [pinMessageDialogOpen, setPinMessageDialogOpen] = useState(false);

  const isWindowWidthNotNarrow =
    containerWidthBreakpoint !== WidthBreakpoint.Narrow;

  const popperPreventOverflowModifier =
    useCallback((): Partial<PreventOverflowModifier> => {
      return {
        name: 'preventOverflow',
        options: {
          altAxis: true,
          boundary: containerElementRef.current || undefined,
          padding: {
            bottom: 16,
            left: 8,
            right: 8,
            top: 16,
          },
        },
      };
    }, [containerElementRef]);

  const toggleReactionPicker = useCallback(
    (onlyRemove = false): void => {
      if (reactionPickerRoot) {
        document.body.removeChild(reactionPickerRoot);
        setReactionPickerRoot(undefined);
        return;
      }

      if (!onlyRemove) {
        const root = document.createElement('div');
        document.body.appendChild(root);

        setReactionPickerRoot(root);
      }
    },
    [reactionPickerRoot]
  );

  useScrollerLock({
    reason: 'TimelineMessage reactionPicker',
    lockScrollWhen: reactionPickerRoot != null,
    onUserInterrupt() {
      toggleReactionPicker(true);
    },
  });

  useEffect(() => {
    let cleanUpHandler: (() => void) | undefined;
    if (reactionPickerRoot) {
      cleanUpHandler = handleOutsideClick(
        target => {
          if (
            target instanceof Element &&
            target.closest('[data-fun-overlay]') != null
          ) {
            return true;
          }
          toggleReactionPicker(true);
          return true;
        },
        {
          containerElements: [reactionPickerRoot],
          name: 'Message.reactionPicker',
        }
      );
    }
    return () => {
      cleanUpHandler?.();
    };
  });

  const openGenericAttachment = useCallback(
    (event?: React.MouseEvent): void => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (!attachments || attachments.length === 0) {
        return;
      }

      let attachmentsInProgress = 0;
      // check if any attachment needs to be downloaded from servers
      for (const attachment of attachments) {
        if (!isDownloaded(attachment)) {
          kickOffAttachmentDownload({ messageId: id });

          attachmentsInProgress += 1;
        }
      }

      if (attachmentsInProgress !== 0) {
        showAttachmentDownloadStillInProgressToast(attachmentsInProgress);
      }

      if (attachments.length !== 1) {
        saveAttachments(attachments, timestamp);
      } else {
        saveAttachment(attachments[0], timestamp);
      }
    },
    [
      kickOffAttachmentDownload,
      saveAttachments,
      saveAttachment,
      showAttachmentDownloadStillInProgressToast,
      attachments,
      id,
      timestamp,
    ]
  );

  const shouldShowAdditional =
    doesMessageBodyOverflow(text || '') || !isWindowWidthNotNarrow;

  const canSelect = interactivity === MessageInteractivity.Normal;

  const handleDownload = canDownload ? openGenericAttachment : null;

  const handleReplyToMessage = useCallback(() => {
    if (!canReply) {
      return;
    }
    setQuoteByMessageId(conversationId, id);
  }, [canReply, conversationId, id, setQuoteByMessageId]);

  const handleReact = useCallback(() => {
    if (canReact) {
      toggleReactionPicker();
    }
  }, [canReact, toggleReactionPicker]);

  const handleOpenPinMessageDialog = useCallback(() => {
    setPinMessageDialogOpen(true);
  }, []);

  const handlePinnedMessageAdd = useCallback(
    (messageId: string, duration: DurationInSeconds | null) => {
      onPinnedMessageAdd(messageId, duration);
      setPinMessageDialogOpen(false);
    },
    [onPinnedMessageAdd]
  );

  const handleUnpinMessage = useCallback(() => {
    onPinnedMessageRemove(id);
  }, [onPinnedMessageRemove, id]);

  const toggleReactionPickerKeyboard = useToggleReactionPicker(
    handleReact || noop
  );

  useDocumentKeyDown(event => {
    if (isTargeted) {
      toggleReactionPickerKeyboard(event);
    }
  });

  const groupedReactions = useGroupedAndOrderedReactions(
    props.reactions,
    'variantKey'
  );

  const messageEmojis = useMemo(() => {
    return groupedReactions
      .map(groupedReaction => {
        return groupedReaction?.[0]?.variantKey;
      })
      .filter(isNotNil);
  }, [groupedReactions]);

  const renderMessageContextMenu = useCallback(
    (renderer: AxoMenuBuilder.Renderer, children: ReactNode): JSX.Element => {
      return (
        <MessageContextMenu
          i18n={i18n}
          renderer={renderer}
          shouldShowAdditional={shouldShowAdditional}
          onDownload={handleDownload}
          onEdit={
            canEditMessage ? () => setMessageToEdit(conversationId, id) : null
          }
          onReplyToMessage={handleReplyToMessage}
          onReact={handleReact}
          onEndPoll={canEndPoll ? () => endPoll(id) : null}
          onRetryMessageSend={canRetry ? () => retryMessageSend(id) : null}
          onRetryDeleteForEveryone={
            canRetryDeleteForEveryone ? () => retryDeleteForEveryone(id) : null
          }
          onCopy={canCopy ? () => copyMessageText(id) : null}
          onSelect={
            canSelect
              ? () => toggleSelectMessage(conversationId, id, false, true)
              : null
          }
          onForward={
            canForward
              ? () =>
                  toggleForwardMessagesModal({
                    type: ForwardMessagesModalType.Forward,
                    messageIds: [id],
                  })
              : null
          }
          onDeleteMessage={() => {
            toggleDeleteMessagesModal({
              conversationId,
              messageIds: [id],
            });
          }}
          onPinMessage={
            canPinMessages && !isPinned ? handleOpenPinMessageDialog : null
          }
          onUnpinMessage={
            canPinMessages && isPinned ? handleUnpinMessage : null
          }
          onMoreInfo={() =>
            pushPanelForConversation({
              type: PanelType.MessageDetails,
              args: { messageId: id },
            })
          }
        >
          {children}
        </MessageContextMenu>
      );
    },
    [
      canCopy,
      canEditMessage,
      canForward,
      canPinMessages,
      canRetry,
      canSelect,
      canEndPoll,
      canRetryDeleteForEveryone,
      conversationId,
      copyMessageText,
      handleDownload,
      handleReact,
      handleOpenPinMessageDialog,
      handleUnpinMessage,
      endPoll,
      handleReplyToMessage,
      i18n,
      id,
      isPinned,
      pushPanelForConversation,
      retryDeleteForEveryone,
      retryMessageSend,
      setMessageToEdit,
      shouldShowAdditional,
      toggleDeleteMessagesModal,
      toggleForwardMessagesModal,
      toggleSelectMessage,
    ]
  );

  const renderMenu = useCallback(() => {
    return (
      <Manager>
        <MessageMenu
          i18n={i18n}
          isWindowWidthNotNarrow={isWindowWidthNotNarrow}
          direction={direction}
          onDownload={handleDownload}
          onReplyToMessage={canReply ? handleReplyToMessage : null}
          onReact={canReact ? handleReact : null}
          renderMessageContextMenu={renderMessageContextMenu}
        />
        {reactionPickerRoot &&
          createPortal(
            <Popper
              placement="top"
              modifiers={[
                offsetDistanceModifier(4),
                popperPreventOverflowModifier(),
              ]}
            >
              {({ ref, style }) =>
                renderReactionPicker({
                  ref,
                  style,
                  selected: selectedReaction,
                  onClose: toggleReactionPicker,
                  onPick: emoji => {
                    toggleReactionPicker(true);
                    reactToMessage(id, {
                      emoji,
                      remove: emoji === selectedReaction,
                    });
                  },
                  messageEmojis,
                })
              }
            </Popper>,
            reactionPickerRoot
          )}
      </Manager>
    );
  }, [
    i18n,
    isWindowWidthNotNarrow,
    direction,
    canReply,
    canReact,
    handleDownload,
    handleReplyToMessage,
    handleReact,
    reactionPickerRoot,
    popperPreventOverflowModifier,
    renderReactionPicker,
    selectedReaction,
    reactToMessage,
    toggleReactionPicker,
    id,
    messageEmojis,
    renderMessageContextMenu,
  ]);

  const handleWrapperKeyDown = useAxoContextMenuOutsideKeyboardTrigger();

  return (
    <>
      <Message
        {...props}
        renderingContext="conversation/TimelineItem"
        renderMenu={renderMenu}
        renderMessageContextMenu={renderMessageContextMenu}
        onToggleSelect={(selected, shift) => {
          toggleSelectMessage(conversationId, id, shift, selected);
        }}
        onReplyToMessage={handleReplyToMessage}
        onWrapperKeyDown={handleWrapperKeyDown}
      />
      <PinMessageDialog
        i18n={i18n}
        messageId={id}
        open={pinMessageDialogOpen}
        onOpenChange={setPinMessageDialogOpen}
        onPinnedMessageAdd={handlePinnedMessageAdd}
        hasMaxPinnedMessages={hasMaxPinnedMessages}
      />
    </>
  );
}

type MessageMenuProps = {
  i18n: LocalizerType;
  isWindowWidthNotNarrow: boolean;
  onDownload: (() => void) | null;
  onReplyToMessage: (() => void) | null;
  onReact: (() => void) | null;
  renderMessageContextMenu: (
    renderer: AxoMenuBuilder.Renderer,
    children: ReactNode
  ) => ReactNode;
} & Pick<MessageProps, 'i18n' | 'direction'>;

function MessageMenu({
  i18n,
  direction,
  isWindowWidthNotNarrow,
  onDownload,
  onReplyToMessage,
  onReact,
  renderMessageContextMenu,
}: MessageMenuProps) {
  // This a menu meant for mouse use only

  return (
    <div
      className={classNames(
        'module-message__buttons',
        `module-message__buttons--${direction}`
      )}
    >
      {isWindowWidthNotNarrow && (
        <>
          {onReact && (
            <Reference>
              {({ ref: popperRef }) => {
                // Only attach the popper reference to the reaction button if it is
                //   visible (it is hidden when the timeline is narrow)
                const maybePopperRef = isWindowWidthNotNarrow
                  ? popperRef
                  : undefined;

                return (
                  // This a menu meant for mouse use only
                  // eslint-disable-next-line max-len
                  // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
                  <div
                    ref={maybePopperRef}
                    onClick={(event: React.MouseEvent) => {
                      event.stopPropagation();
                      event.preventDefault();

                      onReact();
                    }}
                    role="button"
                    className="module-message__buttons__react"
                    aria-label={i18n('icu:reactToMessage')}
                    onDoubleClick={ev => {
                      // Prevent double click from triggering the replyToMessage action
                      ev.stopPropagation();
                    }}
                  />
                );
              }}
            </Reference>
          )}

          {onDownload && (
            // This a menu meant for mouse use only
            // eslint-disable-next-line max-len
            // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
            <div
              onClick={onDownload}
              role="button"
              aria-label={i18n('icu:downloadAttachment')}
              className={classNames(
                'module-message__buttons__download',
                `module-message__buttons__download--${direction}`
              )}
              onDoubleClick={ev => {
                // Prevent double click from triggering the replyToMessage action
                ev.stopPropagation();
              }}
            />
          )}

          {onReplyToMessage && (
            // This a menu meant for mouse use only
            // eslint-disable-next-line max-len
            // eslint-disable-next-line jsx-a11y/interactive-supports-focus, jsx-a11y/click-events-have-key-events
            <div
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                onReplyToMessage();
              }}
              // This a menu meant for mouse use only
              role="button"
              aria-label={i18n('icu:replyToMessage')}
              className={classNames(
                'module-message__buttons__reply',
                `module-message__buttons__download--${direction}`
              )}
              onDoubleClick={ev => {
                // Prevent double click from triggering the replyToMessage action
                ev.stopPropagation();
              }}
            />
          )}
        </>
      )}
      <Reference>
        {({ ref: popperRef }) => {
          // Only attach the popper reference to the collapsed menu button if
          //   the reaction button is not visible (it is hidden when the
          //   timeline is narrow)
          const maybePopperRef = !isWindowWidthNotNarrow
            ? popperRef
            : undefined;

          return renderMessageContextMenu(
            'AxoDropdownMenu',
            <button
              ref={maybePopperRef}
              type="button"
              aria-label={i18n('icu:messageContextMenuButton')}
              className={classNames(
                'module-message__buttons__menu',
                `module-message__buttons__download--${direction}`
              )}
              onDoubleClick={ev => {
                // Prevent double click from triggering the replyToMessage action
                ev.stopPropagation();
              }}
            />
          );
        }}
      </Reference>
    </div>
  );
}
