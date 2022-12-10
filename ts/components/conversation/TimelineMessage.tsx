// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import { noop } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';
import ReactDOM, { createPortal } from 'react-dom';
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
import { doesMessageBodyOverflow } from './MessageBodyReadMore';
import type { Props as ReactionPickerProps } from './ReactionPicker';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { useToggleReactionPicker } from '../../hooks/useKeyboardShortcuts';
import { saveAttachment } from '../../util/saveAttachment';

export type PropsData = {
  canDownload: boolean;
  canRetry: boolean;
  canRetryDeleteForEveryone: boolean;
  canReact: boolean;
  canReply: boolean;
  selectedReaction?: string;
  isSelected?: boolean;
} & Omit<MessagePropsData, 'renderingContext' | 'menu'>;

export type PropsActions = {
  deleteMessage: (id: string) => void;
  deleteMessageForEveryone: (id: string) => void;
  toggleForwardMessageModal: (id: string) => void;
  reactToMessage: (
    id: string,
    { emoji, remove }: { emoji: string; remove: boolean }
  ) => void;
  retrySend: (id: string) => void;
  retryDeleteForEveryone: (id: string) => void;
  setQuoteByMessageId: (conversationId: string, messageId: string) => void;
} & MessagePropsActions;

export type Props = PropsData &
  PropsActions &
  Omit<PropsHousekeeping, 'isAttachmentPending'> &
  Pick<ReactionPickerProps, 'renderEmojiPicker'> & {
    renderReactionPicker: (
      props: React.ComponentProps<typeof SmartReactionPicker>
    ) => JSX.Element;
  };

type Trigger = {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
};

/**
 * Message with menu/context-menu (as necessary for rendering in the timeline)
 */
export function TimelineMessage(props: Props): JSX.Element {
  const {
    i18n,
    id,
    author,
    attachments,
    canDownload,
    canReact,
    canReply,
    canRetry,
    canDeleteForEveryone,
    canRetryDeleteForEveryone,
    contact,
    payment,
    conversationId,
    containerElementRef,
    containerWidthBreakpoint,
    deletedForEveryone,
    deleteMessage,
    deleteMessageForEveryone,
    direction,
    giftBadge,
    isSelected,
    isSticker,
    isTapToView,
    reactToMessage,
    setQuoteByMessageId,
    renderReactionPicker,
    renderEmojiPicker,
    retrySend,
    retryDeleteForEveryone,
    selectedReaction,
    toggleForwardMessageModal,
    showMessageDetail,
    text,
    timestamp,
  } = props;

  const [reactionPickerRoot, setReactionPickerRoot] = useState<
    HTMLDivElement | undefined
  >(undefined);
  const menuTriggerRef = useRef<Trigger | null>(null);

  const isWindowWidthNotNarrow =
    containerWidthBreakpoint !== WidthBreakpoint.Narrow;

  function popperPreventOverflowModifier(): Partial<PreventOverflowModifier> {
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
  }

  // This id is what connects our triple-dot click with our associated pop-up menu.
  //   It needs to be unique.
  const triggerId = String(id || `${author.id}-${timestamp}`);

  const toggleReactionPicker = React.useCallback(
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

  const openGenericAttachment = (event?: React.MouseEvent): void => {
    const { kickOffAttachmentDownload } = props;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!attachments || attachments.length !== 1) {
      return;
    }

    const attachment = attachments[0];
    if (!isDownloaded(attachment)) {
      kickOffAttachmentDownload({
        attachment,
        messageId: id,
      });
      return;
    }

    saveAttachment(attachment, timestamp);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return;
    }
    if (event.target instanceof HTMLAnchorElement) {
      return;
    }
    if (menuTriggerRef.current) {
      menuTriggerRef.current.handleContextClick(event);
    }
  };

  const canForward =
    !isTapToView && !deletedForEveryone && !giftBadge && !contact && !payment;

  const shouldShowAdditional =
    doesMessageBodyOverflow(text || '') || !isWindowWidthNotNarrow;

  const multipleAttachments = attachments && attachments.length > 1;
  const firstAttachment = attachments && attachments[0];

  const handleDownload =
    canDownload &&
    !isSticker &&
    !multipleAttachments &&
    !isTapToView &&
    firstAttachment &&
    !firstAttachment.pending
      ? openGenericAttachment
      : undefined;

  const handleReplyToMessage = canReply
    ? () => setQuoteByMessageId(conversationId, id)
    : undefined;

  const handleReact = canReact ? () => toggleReactionPicker() : undefined;

  const [hasDOEConfirmation, setHasDOEConfirmation] = useState(false);

  const toggleReactionPickerKeyboard = useToggleReactionPicker(
    handleReact || noop
  );

  useEffect(() => {
    if (isSelected) {
      document.addEventListener('keydown', toggleReactionPickerKeyboard);
    }

    return () => {
      document.removeEventListener('keydown', toggleReactionPickerKeyboard);
    };
  }, [isSelected, toggleReactionPickerKeyboard]);

  return (
    <>
      {hasDOEConfirmation && canDeleteForEveryone && (
        <ConfirmationDialog
          actions={[
            {
              action: () => deleteMessageForEveryone(id),
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          dialogName="TimelineMessage/deleteMessageForEveryone"
          i18n={i18n}
          onClose={() => setHasDOEConfirmation(false)}
        >
          {i18n('deleteForEveryoneWarning')}
        </ConfirmationDialog>
      )}
      <Message
        {...props}
        renderingContext="conversation/TimelineItem"
        onContextMenu={handleContextMenu}
        menu={
          <Manager>
            <MessageMenu
              i18n={i18n}
              triggerId={triggerId}
              isWindowWidthNotNarrow={isWindowWidthNotNarrow}
              direction={direction}
              menuTriggerRef={menuTriggerRef}
              showMenu={handleContextMenu}
              onDownload={handleDownload}
              onReplyToMessage={handleReplyToMessage}
              onReact={handleReact}
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
        }
      />

      <MessageContextMenu
        i18n={i18n}
        triggerId={triggerId}
        shouldShowAdditional={shouldShowAdditional}
        onDownload={handleDownload}
        onReplyToMessage={handleReplyToMessage}
        onReact={handleReact}
        onRetrySend={canRetry ? () => retrySend(id) : undefined}
        onRetryDeleteForEveryone={
          canRetryDeleteForEveryone
            ? () => retryDeleteForEveryone(id)
            : undefined
        }
        onForward={canForward ? () => toggleForwardMessageModal(id) : undefined}
        onDeleteForMe={() => deleteMessage(id)}
        onDeleteForEveryone={
          canDeleteForEveryone ? () => setHasDOEConfirmation(true) : undefined
        }
        onMoreInfo={() => showMessageDetail(id)}
      />
    </>
  );
}

type MessageMenuProps = {
  i18n: LocalizerType;
  triggerId: string;
  isWindowWidthNotNarrow: boolean;
  menuTriggerRef: Ref<Trigger>;
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
                aria-label={i18n('messageContextMenuButton')}
                className={classNames(
                  'module-message__buttons__menu',
                  `module-message__buttons__download--${direction}`
                )}
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
                    aria-label={i18n('reactToMessage')}
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
              aria-label={i18n('downloadAttachment')}
              className={classNames(
                'module-message__buttons__download',
                `module-message__buttons__download--${direction}`
              )}
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
              aria-label={i18n('replyToMessage')}
              className={classNames(
                'module-message__buttons__reply',
                `module-message__buttons__download--${direction}`
              )}
            />
          )}
        </>
      )}
      {menuButton}
    </div>
  );
}

type MessageContextProps = {
  i18n: LocalizerType;
  triggerId: string;
  shouldShowAdditional: boolean;

  onDownload: (() => void) | undefined;
  onReplyToMessage: (() => void) | undefined;
  onReact: (() => void) | undefined;
  onRetrySend: (() => void) | undefined;
  onRetryDeleteForEveryone: (() => void) | undefined;
  onForward: (() => void) | undefined;
  onDeleteForMe: () => void;
  onDeleteForEveryone: (() => void) | undefined;
  onMoreInfo: () => void;
};

const MessageContextMenu = ({
  i18n,
  triggerId,
  shouldShowAdditional,
  onDownload,
  onReplyToMessage,
  onReact,
  onMoreInfo,
  onRetrySend,
  onRetryDeleteForEveryone,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
}: MessageContextProps): JSX.Element => {
  const menu = (
    <ContextMenu id={triggerId}>
      {shouldShowAdditional && (
        <>
          {onDownload && (
            <MenuItem
              attributes={{
                className:
                  'module-message__context--icon module-message__context__download',
              }}
              onClick={onDownload}
            >
              {i18n('downloadAttachment')}
            </MenuItem>
          )}
          {onReplyToMessage && (
            <MenuItem
              attributes={{
                className:
                  'module-message__context--icon module-message__context__reply',
              }}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                onReplyToMessage();
              }}
            >
              {i18n('replyToMessage')}
            </MenuItem>
          )}
          {onReact && (
            <MenuItem
              attributes={{
                className:
                  'module-message__context--icon module-message__context__react',
              }}
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                event.preventDefault();

                onReact();
              }}
            >
              {i18n('reactToMessage')}
            </MenuItem>
          )}
        </>
      )}
      <MenuItem
        attributes={{
          className:
            'module-message__context--icon module-message__context__more-info',
        }}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          onMoreInfo();
        }}
      >
        {i18n('moreInfo')}
      </MenuItem>
      {onRetrySend && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__retry-send',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onRetrySend();
          }}
        >
          {i18n('retrySend')}
        </MenuItem>
      )}
      {onRetryDeleteForEveryone && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__delete-message-for-everyone',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onRetryDeleteForEveryone();
          }}
        >
          {i18n('retryDeleteForEveryone')}
        </MenuItem>
      )}
      {onForward && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__forward-message',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onForward();
          }}
        >
          {i18n('forwardMessage')}
        </MenuItem>
      )}
      <MenuItem
        attributes={{
          className:
            'module-message__context--icon module-message__context__delete-message',
        }}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          onDeleteForMe();
        }}
      >
        {i18n('deleteMessage')}
      </MenuItem>
      {onDeleteForEveryone && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__delete-message-for-everyone',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onDeleteForEveryone();
          }}
        >
          {i18n('deleteMessageForEveryone')}
        </MenuItem>
      )}
    </ContextMenu>
  );

  return ReactDOM.createPortal(menu, document.body);
};
