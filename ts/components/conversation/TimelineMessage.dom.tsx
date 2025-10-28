// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import lodash from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Ref } from 'react';
import { ContextMenuTrigger } from 'react-contextmenu';
import { createPortal } from 'react-dom';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow.js';
import { isDownloaded } from '../../util/Attachment.std.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import { handleOutsideClick } from '../../util/handleOutsideClick.dom.js';
import { offsetDistanceModifier } from '../../util/popperUtil.std.js';
import { StopPropagation } from '../StopPropagation.dom.js';
import { WidthBreakpoint } from '../_util.std.js';
import { Message } from './Message.dom.js';
import type { SmartReactionPicker } from '../../state/smart/ReactionPicker.dom.js';
import type {
  Props as MessageProps,
  PropsActions as MessagePropsActions,
  PropsData as MessagePropsData,
  PropsHousekeeping,
} from './Message.dom.js';
import type { PushPanelForConversationActionType } from '../../state/ducks/conversations.preload.js';
import { doesMessageBodyOverflow } from './MessageBodyReadMore.dom.js';
import {
  useKeyboardShortcutsConditionally,
  useOpenContextMenu,
  useToggleReactionPicker,
} from '../../hooks/useKeyboardShortcuts.dom.js';
import { PanelType } from '../../types/Panels.std.js';
import type {
  DeleteMessagesPropsType,
  ForwardMessagesPayload,
} from '../../state/ducks/globalModals.preload.js';
import { useScrollerLock } from '../../hooks/useScrollLock.dom.js';
import {
  type ContextMenuTriggerType,
  MessageContextMenu,
  useHandleMessageContextMenu,
} from './MessageContextMenu.dom.js';
import { ForwardMessagesModalType } from '../ForwardMessagesModal.dom.js';
import { useGroupedAndOrderedReactions } from '../../util/groupAndOrderReactions.dom.js';
import { isNotNil } from '../../util/isNotNil.std.js';

const { noop } = lodash;

export type PropsData = {
  canDownload: boolean;
  canCopy: boolean;
  canEditMessage: boolean;
  canForward: boolean;
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
    author,
    canDownload,
    canCopy,
    canEditMessage,
    canForward,
    canReact,
    canReply,
    canRetry,
    canRetryDeleteForEveryone,
    containerElementRef,
    containerWidthBreakpoint,
    conversationId,
    direction,
    i18n,
    id,
    isTargeted,
    kickOffAttachmentDownload,
    copyMessageText,
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

  const handleContextMenu = useHandleMessageContextMenu(menuTriggerRef);

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
    toggleReactionPicker,
    id,
    messageEmojis,
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
