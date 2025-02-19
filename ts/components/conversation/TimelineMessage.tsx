// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import { noop } from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { ContextMenuTrigger } from 'react-contextmenu';
import { createPortal } from 'react-dom';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow';
import { isDownloaded } from '../../types/Attachment';
import type { LocalizerType } from '../../types/I18N';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import { offsetDistanceModifier } from '../../util/popperUtil';
import { StopPropagation } from '../StopPropagation';
import { WidthBreakpoint } from '../_util';
import { Message } from './Message';
import type { SmartReactionPicker } from '../../state/smart/ReactionPicker';
import type {
  Props as MessageProps,
  PropsActions as MessagePropsActions,
  PropsData as MessagePropsData,
  PropsHousekeeping,
} from './Message';
import type { PushPanelForConversationActionType } from '../../state/ducks/conversations';
import { doesMessageBodyOverflow } from './MessageBodyReadMore';
import type { Props as ReactionPickerProps } from './ReactionPicker';
import {
  useKeyboardShortcutsConditionally,
  useOpenContextMenu,
  useToggleReactionPicker,
} from '../../hooks/useKeyboardShortcuts';
import { PanelType } from '../../types/Panels';
import type {
  DeleteMessagesPropsType,
  ForwardMessagesPayload,
} from '../../state/ducks/globalModals';
import { useScrollerLock } from '../../hooks/useScrollLock';
import {
  type ContextMenuTriggerType,
  MessageContextMenu,
  useHandleMessageContextMenu,
} from './MessageContextMenu';
import { ForwardMessagesModalType } from '../ForwardMessagesModal';

export type PropsData = {
  canDownload: boolean;
  canCopy: boolean;
  canEditMessage: boolean;
  canRetry: boolean;
  canRetryDeleteForEveryone: boolean;
  canReact: boolean;
  canReply: boolean;
  selectedReaction?: string;
  isTargeted?: boolean;
} & Omit<MessagePropsData, 'renderingContext' | 'menu'>;

export type PropsActions = {
  pushPanelForConversation: PushPanelForConversationActionType;
  toggleDeleteMessagesModal: (props: DeleteMessagesPropsType) => void;
  toggleForwardMessagesModal: (payload: ForwardMessagesPayload) => void;
  reactToMessage: (
    id: string,
    { emoji, remove }: { emoji: string; remove: boolean }
  ) => void;
  retryMessageSend: (id: string) => void;
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
  Omit<PropsHousekeeping, 'isAttachmentPending'> &
  Pick<ReactionPickerProps, 'renderEmojiPicker'> & {
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
    author,
    canDownload,
    canCopy,
    canEditMessage,
    canReact,
    canReply,
    canRetry,
    canRetryDeleteForEveryone,
    containerElementRef,
    containerWidthBreakpoint,
    conversationId,
    deletedForEveryone,
    direction,
    giftBadge,
    i18n,
    id,
    isTargeted,
    isTapToView,
    kickOffAttachmentDownload,
    payment,
    copyMessageText,
    pushPanelForConversation,
    reactToMessage,
    renderEmojiPicker,
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
  const menuTriggerRef = useRef<ContextMenuTriggerType | null>(null);

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

  // This id is what connects our triple-dot click with our associated pop-up menu.
  //   It needs to be unique.
  const triggerId = String(id || `${author.id}-${timestamp}`);

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
        () => {
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

  const handleContextMenu = useHandleMessageContextMenu(menuTriggerRef);
  const canForward =
    !isTapToView && !deletedForEveryone && !giftBadge && !payment;

  const shouldShowAdditional =
    doesMessageBodyOverflow(text || '') || !isWindowWidthNotNarrow;

  const handleDownload = canDownload ? openGenericAttachment : undefined;

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

  const toggleReactionPickerKeyboard = useToggleReactionPicker(
    handleReact || noop
  );

  const openContextMenuKeyboard = useOpenContextMenu(handleContextMenu);

  useKeyboardShortcutsConditionally(
    Boolean(isTargeted),
    openContextMenuKeyboard,
    toggleReactionPickerKeyboard
  );

  const renderMenu = useCallback(() => {
    return (
      <Manager>
        <MessageMenu
          i18n={i18n}
          triggerId={triggerId}
          isWindowWidthNotNarrow={isWindowWidthNotNarrow}
          direction={direction}
          menuTriggerRef={menuTriggerRef}
          showMenu={handleContextMenu}
          onDownload={handleDownload}
          onReplyToMessage={canReply ? handleReplyToMessage : undefined}
          onReact={canReact ? handleReact : undefined}
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
                  renderEmojiPicker,
                })
              }
            </Popper>,
            reactionPickerRoot
          )}
      </Manager>
    );
  }, [
    i18n,
    triggerId,
    isWindowWidthNotNarrow,
    direction,
    menuTriggerRef,
    canReply,
    canReact,
    handleContextMenu,
    handleDownload,
    handleReplyToMessage,
    handleReact,
    reactionPickerRoot,
    popperPreventOverflowModifier,
    renderReactionPicker,
    selectedReaction,
    reactToMessage,
    renderEmojiPicker,
    toggleReactionPicker,
    id,
  ]);

  return (
    <>
      <Message
        {...props}
        renderingContext="conversation/TimelineItem"
        onContextMenu={handleContextMenu}
        renderMenu={renderMenu}
        onToggleSelect={(selected, shift) => {
          toggleSelectMessage(conversationId, id, shift, selected);
        }}
        onReplyToMessage={handleReplyToMessage}
      />

      <MessageContextMenu
        i18n={i18n}
        triggerId={triggerId}
        shouldShowAdditional={shouldShowAdditional}
        interactionMode={props.interactionMode}
        onDownload={handleDownload}
        onEdit={
          canEditMessage
            ? () => setMessageToEdit(conversationId, id)
            : undefined
        }
        onReplyToMessage={handleReplyToMessage}
        onReact={handleReact}
        onRetryMessageSend={canRetry ? () => retryMessageSend(id) : undefined}
        onRetryDeleteForEveryone={
          canRetryDeleteForEveryone
            ? () => retryDeleteForEveryone(id)
            : undefined
        }
        onCopy={canCopy ? () => copyMessageText(id) : undefined}
        onSelect={() => toggleSelectMessage(conversationId, id, false, true)}
        onForward={
          canForward
            ? () =>
                toggleForwardMessagesModal({
                  type: ForwardMessagesModalType.Forward,
                  messageIds: [id],
                })
            : undefined
        }
        onDeleteMessage={() => {
          toggleDeleteMessagesModal({
            conversationId,
            messageIds: [id],
          });
        }}
        onMoreInfo={() =>
          pushPanelForConversation({
            type: PanelType.MessageDetails,
            args: { messageId: id },
          })
        }
      />
    </>
  );
}

type MessageMenuProps = {
  i18n: LocalizerType;
  triggerId: string;
  isWindowWidthNotNarrow: boolean;
  menuTriggerRef: Ref<ContextMenuTriggerType>;
  showMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDownload: (() => void) | undefined;
  onReplyToMessage: (() => void) | undefined;
  onReact: (() => void) | undefined;
} & Pick<MessageProps, 'i18n' | 'direction'>;

function MessageMenu({
  i18n,
  triggerId,
  direction,
  isWindowWidthNotNarrow,
  menuTriggerRef,
  showMenu,
  onDownload,
  onReplyToMessage,
  onReact,
}: MessageMenuProps) {
  // This a menu meant for mouse use only
  /* eslint-disable jsx-a11y/interactive-supports-focus */
  /* eslint-disable jsx-a11y/click-events-have-key-events */
  const menuButton = (
    <Reference>
      {({ ref: popperRef }) => {
        // Only attach the popper reference to the collapsed menu button if the reaction
        //   button is not visible (it is hidden when the timeline is narrow)
        const maybePopperRef = !isWindowWidthNotNarrow ? popperRef : undefined;

        return (
          <StopPropagation className="module-message__buttons__menu--container">
            <ContextMenuTrigger
              id={triggerId}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ref={menuTriggerRef as any}
            >
              <div
                ref={maybePopperRef}
                role="button"
                onClick={showMenu}
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
            </ContextMenuTrigger>
          </StopPropagation>
        );
      }}
    </Reference>
  );
  /* eslint-enable jsx-a11y/interactive-supports-focus */
  /* eslint-enable jsx-a11y/click-events-have-key-events */

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
      {menuButton}
    </div>
  );
}
