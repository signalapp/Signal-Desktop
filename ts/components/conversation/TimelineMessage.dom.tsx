// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow.js';
import { isDownloaded } from '../../util/Attachment.std.js';
import { handleOutsideClick } from '../../util/handleOutsideClick.dom.js';
import { offsetDistanceModifier } from '../../util/popperUtil.std.js';
import { Message, MessageInteractivity } from './Message.dom.js';
import type { SmartReactionPicker } from '../../state/smart/ReactionPicker.dom.js';
import type {
  PropsActions as MessagePropsActions,
  PropsData as MessagePropsData,
  PropsHousekeeping,
} from './Message.dom.js';
import type { PushPanelForConversationActionType } from '../../state/ducks/conversations.preload.js';
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
  canPinMessage: boolean;
  selectedReaction?: string;
  isTargeted?: boolean;
} & Omit<MessagePropsData, 'renderingContext' | 'menu'>;

export type PropsActions = {
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
  showPinMessageDialog: (
    messageId: string,
    isPinningDisappearingMessage: boolean
  ) => void;
  handleDebugMessage: () => void;
} & Omit<MessagePropsActions, 'onToggleSelect' | 'onReplyToMessage'>;

export type Props = PropsData &
  PropsActions &
  Omit<PropsHousekeeping, 'isAttachmentPending'> & {
    renderReactionPicker: (
      props: React.ComponentProps<typeof SmartReactionPicker>
    ) => React.JSX.Element;
  };

/**
 * Message with menu/context-menu (as necessary for rendering in the timeline)
 */
export function TimelineMessage(props: Props): React.JSX.Element {
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
    canPinMessage,
    containerElementRef,
    conversationId,
    i18n,
    id,
    interactivity,
    isPinned,
    isTargeted,
    kickOffAttachmentDownload,
    copyMessageText,
    endPoll,
    expirationLength,
    handleDebugMessage,
    onPinnedMessageRemove,
    pushPanelForConversation,
    reactToMessage,
    renderReactionPicker,
    retryDeleteForEveryone,
    retryMessageSend,
    saveAttachment,
    saveAttachments,
    showAttachmentDownloadStillInProgressToast,
    showPinMessageDialog,
    selectedReaction,
    setQuoteByMessageId,
    setMessageToEdit,
    timestamp,
    toggleDeleteMessagesModal,
    toggleForwardMessagesModal,
    toggleSelectMessage,
  } = props;

  const [reactionPickerRoot, setReactionPickerRoot] = useState<
    HTMLDivElement | undefined
  >(undefined);


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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        saveAttachment(attachments[0]!, timestamp);
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

  const isDisappearingMessage = expirationLength != null;

  const handleOpenPinMessageDialog = useCallback(() => {
    showPinMessageDialog(id, isDisappearingMessage);
  }, [showPinMessageDialog, id, isDisappearingMessage]);

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
    (
      renderer: AxoMenuBuilder.Renderer,
      children: ReactNode
    ): React.JSX.Element => {
      return (
        <MessageContextMenu
          i18n={i18n}
          renderer={renderer}
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
            canPinMessage && !isPinned ? handleOpenPinMessageDialog : null
          }
          onUnpinMessage={canPinMessage && isPinned ? handleUnpinMessage : null}
          onMoreInfo={() =>
            pushPanelForConversation({
              type: PanelType.MessageDetails,
              args: { messageId: id },
            })
          }
          onDebugMessage={handleDebugMessage}
        >
          {children}
        </MessageContextMenu>
      );
    },
    [
      canCopy,
      canEditMessage,
      canForward,
      canPinMessage,
      canRetry,
      canSelect,
      canEndPoll,
      canRetryDeleteForEveryone,
      conversationId,
      copyMessageText,
      handleDebugMessage,
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
      toggleDeleteMessagesModal,
      toggleForwardMessagesModal,
      toggleSelectMessage,
    ]
  );


  const handleWrapperKeyDown = useAxoContextMenuOutsideKeyboardTrigger();

  return (
    <Manager>
      <Reference>
        {({ ref: popperRef }) => (
          <div ref={popperRef}>
            <Message
              {...props}
              renderingContext="conversation/TimelineItem"
              renderMessageContextMenu={renderMessageContextMenu}
              onToggleSelect={(selected, shift) => {
                toggleSelectMessage(conversationId, id, shift, selected);
              }}
              onReplyToMessage={handleReplyToMessage}
              onWrapperKeyDown={handleWrapperKeyDown}
            />
          </div>
        )}
      </Reference>
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
}

