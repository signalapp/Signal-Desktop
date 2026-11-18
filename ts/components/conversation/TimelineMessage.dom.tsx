// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, ComponentProps, JSX, MouseEvent, Ref } from 'react';
import { Popover } from 'radix-ui';
import { tinykeys } from 'tinykeys';
import { isDownloaded } from '../../util/Attachment.std.ts';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { WidthBreakpoint } from '../_util.std.ts';
import { Message, MessageInteractivity } from './Message.dom.tsx';
import type { SmartReactionPicker } from '../../state/smart/ReactionPicker.dom.tsx';
import type {
  Props as MessageProps,
  PropsActions as MessagePropsActions,
  PropsData as MessagePropsData,
  PropsHousekeeping,
} from './Message.dom.tsx';
import type { PushPanelForConversationActionType } from '../../state/ducks/conversations.preload.ts';
import { doesMessageBodyOverflow } from './MessageBodyReadMore.dom.tsx';
import { useHasAnyOverlay } from '../../hooks/useKeyboardShortcuts.dom.tsx';
import { PanelType } from '../../types/Panels.std.ts';
import type {
  DeleteMessagesPropsType,
  ForwardMessagesPayload,
} from '../../state/ducks/globalModals.preload.ts';
import { useScrollerLock } from '../../hooks/useScrollLock.dom.tsx';
import { MessageContextMenu } from './MessageContextMenu.dom.tsx';
import { ForwardMessagesModalType } from '../ForwardMessagesModal.dom.tsx';
import { useGroupedAndOrderedReactions } from '../../util/groupAndOrderReactions.std.ts';
import { isNotNil } from '../../util/isNotNil.std.ts';
import type { AxoMenuBuilder } from '../../axo/menus/AxoMenuBuilder.dom.tsx';
import { AxoContextMenu } from '../../axo/menus/AxoContextMenu.dom.tsx';
import type { Emoji } from '../../axo/emoji.std.ts';
import type { StickerReferenceType } from '../../types/Stickers.preload.ts';

const { useAxoContextMenuOutsideKeyboardTrigger } = AxoContextMenu;

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
  canReplyPrivately: boolean;
  canPinMessage: boolean;
  selectedReaction?: Emoji.Variant;
  stickerRef: StickerReferenceType | undefined;
  isFavoriteSticker: boolean;
  isTargeted: boolean;
  isSignalConversation: boolean;
} & Omit<MessagePropsData, 'renderingContext' | 'menu'>;

export type PropsActions = {
  onPinnedMessageRemove: (messageId: string) => void;
  pushPanelForConversation: PushPanelForConversationActionType;
  toggleDeleteMessagesModal: (props: DeleteMessagesPropsType) => void;
  toggleForwardMessagesModal: (payload: ForwardMessagesPayload) => void;
  endPoll: (id: string) => void;
  reactToMessage: (
    id: string,
    { emoji, remove }: { emoji: Emoji.Variant; remove: boolean }
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
  replyPrivately: (messageId: string) => void;
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
  handleClickCtaButton: (callToActionId: string) => void;
  handleDebugMessage: () => void;
  markStickerAsFavorite: (
    stickerRef: StickerReferenceType,
    markAsFavorite: boolean
  ) => void;
} & Omit<MessagePropsActions, 'onToggleSelect' | 'onReplyToMessage'>;

export type Props = PropsData &
  PropsActions &
  Omit<PropsHousekeeping, 'isAttachmentPending'> & {
    renderReactionPicker: (
      props: ComponentProps<typeof SmartReactionPicker>
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
    canReplyPrivately,
    canRetry,
    canRetryDeleteForEveryone,
    canPinMessage,
    containerElementRef,
    containerWidthBreakpoint,
    conversationId,
    direction,
    i18n,
    id,
    interactivity,
    isFavoriteSticker,
    isPinned,
    isSignalConversation,
    isTargeted,
    kickOffAttachmentDownload,
    copyMessageText,
    endPoll,
    expirationLength,
    handleDebugMessage,
    markStickerAsFavorite,
    onPinnedMessageRemove,
    pushPanelForConversation,
    reactToMessage,
    renderReactionPicker,
    replyPrivately,
    retryDeleteForEveryone,
    retryMessageSend,
    saveAttachment,
    saveAttachments,
    showAttachmentDownloadStillInProgressToast,
    showPinMessageDialog,
    selectedReaction,
    setQuoteByMessageId,
    setMessageToEdit,
    stickerRef,
    text,
    timestamp,
    toggleDeleteMessagesModal,
    toggleForwardMessagesModal,
    toggleSelectMessage,
  } = props;

  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);

  const isWindowWidthNotNarrow =
    containerWidthBreakpoint !== WidthBreakpoint.Narrow;

  const reactionPickerCollisionBoundary = containerElementRef.current;

  const toggleReactionPicker = useCallback((onlyRemove = false): void => {
    setReactionPickerOpen(open => (onlyRemove ? false : !open));
  }, []);

  const closeReactionPicker = useCallback(() => {
    setReactionPickerOpen(false);
  }, []);

  const reactionPickerAnchorRef = useRef<HTMLButtonElement>(null);

  // Let the anchor button toggle the picker instead of Radix closing it first
  const handleReactionPickerPointerDownOutside = useCallback((event: Event) => {
    const { target } = event;
    if (
      target instanceof Node &&
      reactionPickerAnchorRef.current?.contains(target)
    ) {
      event.preventDefault();
    }
  }, []);

  useScrollerLock({
    reason: 'TimelineMessage reactionPicker',
    lockScrollWhen: reactionPickerOpen,
    onUserInterrupt() {
      toggleReactionPicker(true);
    },
  });

  const openGenericAttachment = useCallback(
    (event?: MouseEvent): void => {
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
        // oxlint-disable-next-line typescript/no-non-null-assertion
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

  const shouldShowAdditional =
    doesMessageBodyOverflow(text || '') || !isWindowWidthNotNarrow;

  const canSelect = interactivity === MessageInteractivity.Normal;

  const handleDownload = canDownload ? openGenericAttachment : null;

  const handleFavoriteSticker = useCallback(() => {
    if (!stickerRef) {
      return;
    }

    markStickerAsFavorite(stickerRef, !isFavoriteSticker);
  }, [isFavoriteSticker, stickerRef, markStickerAsFavorite]);

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

  const hasOverlay = useHasAnyOverlay();

  const onReactShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (hasOverlay) {
      return;
    }
    if (!isTargeted) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    handleReact();
  });

  useEffect(() => {
    return tinykeys(window, {
      '$mod+Shift+E': onReactShortcut,
    });
  }, []);

  const groupedReactions = useGroupedAndOrderedReactions(
    props.reactions,
    'variant'
  );

  const messageEmojis = useMemo(() => {
    return groupedReactions
      .map(groupedReaction => {
        return groupedReaction?.[0]?.variant;
      })
      .filter(isNotNil);
  }, [groupedReactions]);

  const handleMessageContextMenuOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        closeReactionPicker();
      }
    },
    [closeReactionPicker]
  );

  const renderMessageContextMenu = useCallback(
    (renderer: AxoMenuBuilder.Renderer, children: ReactNode): JSX.Element => {
      return (
        <MessageContextMenu
          i18n={i18n}
          renderer={renderer}
          onOpenChange={handleMessageContextMenuOpenChange}
          shouldShowAdditional={shouldShowAdditional}
          onDownload={handleDownload}
          onEdit={
            canEditMessage ? () => setMessageToEdit(conversationId, id) : null
          }
          onReplyToMessage={handleReplyToMessage}
          onReplyPrivately={canReplyPrivately ? () => replyPrivately(id) : null}
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
          onFavoriteSticker={
            stickerRef && !isFavoriteSticker ? handleFavoriteSticker : null
          }
          onUnfavoriteSticker={
            stickerRef && isFavoriteSticker ? handleFavoriteSticker : null
          }
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
      canReplyPrivately,
      canRetry,
      canSelect,
      canEndPoll,
      canRetryDeleteForEveryone,
      conversationId,
      copyMessageText,
      handleDebugMessage,
      handleDownload,
      handleFavoriteSticker,
      handleMessageContextMenuOpenChange,
      handleReact,
      handleOpenPinMessageDialog,
      handleUnpinMessage,
      endPoll,
      handleReplyToMessage,
      i18n,
      id,
      isFavoriteSticker,
      isPinned,
      pushPanelForConversation,
      replyPrivately,
      retryDeleteForEveryone,
      retryMessageSend,
      setMessageToEdit,
      shouldShowAdditional,
      stickerRef,
      toggleDeleteMessagesModal,
      toggleForwardMessagesModal,
      toggleSelectMessage,
    ]
  );

  const renderMenu = useCallback(() => {
    return (
      <Popover.Root
        open={reactionPickerOpen}
        onOpenChange={setReactionPickerOpen}
        modal={false}
      >
        <MessageMenu
          i18n={i18n}
          isFavoriteSticker={isFavoriteSticker}
          isWindowWidthNotNarrow={isWindowWidthNotNarrow}
          direction={direction}
          onDownload={handleDownload}
          onFavoriteSticker={stickerRef ? handleFavoriteSticker : null}
          onReplyToMessage={canReply ? handleReplyToMessage : null}
          onReact={canReact ? handleReact : null}
          reactionPickerAnchorRef={reactionPickerAnchorRef}
          reactionPickerOpen={reactionPickerOpen}
          renderMessageContextMenu={renderMessageContextMenu}
        />
        <Popover.Portal>
          <Popover.Content
            aria-label={i18n('icu:reactToMessage')}
            side="top"
            sideOffset={4}
            collisionBoundary={reactionPickerCollisionBoundary}
            collisionPadding={{ top: 16, bottom: 16, left: 8, right: 8 }}
            // ReactionPicker manages its own focus
            onOpenAutoFocus={event => event.preventDefault()}
            onCloseAutoFocus={event => event.preventDefault()}
            onFocusOutside={event => event.preventDefault()}
            onPointerDownOutside={handleReactionPickerPointerDownOutside}
          >
            {renderReactionPicker({
              selected: selectedReaction,
              onClose: closeReactionPicker,
              onPick: emoji => {
                toggleReactionPicker(true);
                reactToMessage(id, {
                  emoji,
                  remove: emoji === selectedReaction,
                });
              },
              messageEmojis,
            })}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }, [
    i18n,
    isFavoriteSticker,
    isWindowWidthNotNarrow,
    direction,
    canReply,
    canReact,
    handleDownload,
    handleFavoriteSticker,
    handleReplyToMessage,
    handleReact,
    reactionPickerOpen,
    reactionPickerCollisionBoundary,
    closeReactionPicker,
    handleReactionPickerPointerDownOutside,
    renderReactionPicker,
    selectedReaction,
    stickerRef,
    reactToMessage,
    toggleReactionPicker,
    id,
    messageEmojis,
    renderMessageContextMenu,
  ]);

  const handleWrapperKeyDown = useAxoContextMenuOutsideKeyboardTrigger();

  return (
    <Message
      {...props}
      renderingContext="conversation/TimelineItem"
      renderMenu={isSignalConversation ? undefined : renderMenu}
      renderMessageContextMenu={renderMessageContextMenu}
      onToggleSelect={(selected, shift) => {
        toggleSelectMessage(conversationId, id, shift, selected);
      }}
      onReplyToMessage={handleReplyToMessage}
      onWrapperKeyDown={handleWrapperKeyDown}
    />
  );
}

type MessageMenuProps = {
  i18n: LocalizerType;
  isFavoriteSticker: boolean;
  isWindowWidthNotNarrow: boolean;
  onDownload: (() => void) | null;
  onFavoriteSticker: (() => void) | null;
  onReplyToMessage: (() => void) | null;
  onReact: (() => void) | null;
  reactionPickerAnchorRef: Ref<HTMLButtonElement>;
  reactionPickerOpen: boolean;
  renderMessageContextMenu: (
    renderer: AxoMenuBuilder.Renderer,
    children: ReactNode
  ) => ReactNode;
} & Pick<MessageProps, 'i18n' | 'direction'>;

function MessageMenu({
  i18n,
  direction,
  isFavoriteSticker,
  isWindowWidthNotNarrow,
  onDownload,
  onFavoriteSticker,
  onReplyToMessage,
  onReact,
  reactionPickerAnchorRef,
  reactionPickerOpen,
  renderMessageContextMenu,
}: MessageMenuProps) {
  const menuButton = (
    <button
      ref={isWindowWidthNotNarrow ? undefined : reactionPickerAnchorRef}
      type="button"
      aria-label={i18n('icu:messageContextMenuButton')}
      className="module-message__buttons__menu"
      onDoubleClick={ev => {
        // Prevent double click from triggering the replyToMessage action
        ev.stopPropagation();
      }}
    />
  );

  return (
    <div
      className={classNames(
        'module-message__buttons',
        direction === 'incoming' && 'module-message__buttons--incoming',
        direction === 'outgoing' && 'module-message__buttons--outgoing'
      )}
    >
      {isWindowWidthNotNarrow && (
        <>
          {onReact && (
            // The reaction picker is anchored to the reaction button when it's
            // visible (it is hidden when the timeline is narrow)
            <Popover.Anchor asChild>
              <button
                ref={reactionPickerAnchorRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={reactionPickerOpen}
                onClick={(event: MouseEvent) => {
                  event.stopPropagation();
                  event.preventDefault();

                  onReact();
                }}
                className="module-message__buttons__react"
                aria-label={i18n('icu:reactToMessage')}
                onDoubleClick={ev => {
                  // Prevent double click from triggering the replyToMessage action
                  ev.stopPropagation();
                }}
              />
            </Popover.Anchor>
          )}

          {onFavoriteSticker && (
            <button
              type="button"
              onClick={onFavoriteSticker}
              aria-label={
                isFavoriteSticker
                  ? i18n('icu:messageContextMenu__sticker--removeFavorite')
                  : i18n('icu:messageContextMenu__sticker--addFavorite')
              }
              className={
                isFavoriteSticker
                  ? 'module-message__buttons__unfavorite'
                  : 'module-message__buttons__favorite'
              }
              onDoubleClick={ev => {
                // Prevent double click from triggering the replyToMessage action
                ev.stopPropagation();
              }}
            />
          )}

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              aria-label={i18n('icu:downloadAttachment')}
              className="module-message__buttons__download"
              onDoubleClick={ev => {
                // Prevent double click from triggering the replyToMessage action
                ev.stopPropagation();
              }}
            />
          )}

          {onReplyToMessage && (
            <button
              type="button"
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                onReplyToMessage();
              }}
              aria-label={i18n('icu:replyToMessage')}
              className="module-message__buttons__reply"
              onDoubleClick={ev => {
                // Prevent double click from triggering the replyToMessage action
                ev.stopPropagation();
              }}
            />
          )}
        </>
      )}
      {renderMessageContextMenu(
        'AxoDropdownMenu',
        isWindowWidthNotNarrow ? (
          menuButton
        ) : (
          // When the timeline is narrow, the reaction button is hidden and
          // the picker is anchored to the menu button instead
          <Popover.Anchor asChild>{menuButton}</Popover.Anchor>
        )
      )}
    </div>
  );
}
