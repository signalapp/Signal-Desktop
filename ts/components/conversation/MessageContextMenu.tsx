// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type RefObject } from 'react';
import { ContextMenu, MenuItem } from 'react-contextmenu';
import ReactDOM from 'react-dom';
import type { LocalizerType } from '../../types/I18N';
import type { InteractionModeType } from '../../state/ducks/conversations';

export type ContextMenuTriggerType = {
  handleContextClick: (
    event: React.MouseEvent<HTMLDivElement> | MouseEvent
  ) => void;
};

type MessageContextProps = {
  i18n: LocalizerType;
  triggerId: string;
  shouldShowAdditional: boolean;
  interactionMode: InteractionModeType;
  onDownload: (() => void) | undefined;
  onEdit: (() => void) | undefined;
  onReplyToMessage: (() => void) | undefined;
  onReact: (() => void) | undefined;
  onRetryMessageSend: (() => void) | undefined;
  onRetryDeleteForEveryone: (() => void) | undefined;
  onCopy: (() => void) | undefined;
  onForward: (() => void) | undefined;
  onDeleteMessage: () => void;
  onMoreInfo: (() => void) | undefined;
  onSelect: (() => void) | undefined;
};
export const MessageContextMenu = ({
  i18n,
  triggerId,
  shouldShowAdditional,
  interactionMode,
  onDownload,
  onEdit,
  onReplyToMessage,
  onReact,
  onMoreInfo,
  onCopy,
  onSelect,
  onRetryMessageSend,
  onRetryDeleteForEveryone,
  onForward,
  onDeleteMessage,
}: MessageContextProps): JSX.Element => {
  const menu = (
    // We avoid restoring focus on this context menu because it is not intended for
    // keyboard use and restoring focus to the message could cause an unwanted scroll
    <ContextMenu
      id={triggerId}
      // In keyboard mode, we do want to restore focus to the message; the message is very
      // likely already scrolled into view in this case.
      avoidFocusRestoreOnBlur={interactionMode !== 'keyboard'}
    >
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
              {i18n('icu:MessageContextMenu__download')}
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
              {i18n('icu:MessageContextMenu__reply')}
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
              {i18n('icu:MessageContextMenu__react')}
            </MenuItem>
          )}
        </>
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
          {i18n('icu:MessageContextMenu__forward')}
        </MenuItem>
      )}
      {onEdit && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__edit-message',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onEdit();
          }}
        >
          {i18n('icu:edit')}
        </MenuItem>
      )}
      {onSelect && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__select',
          }}
          onClick={() => {
            onSelect();
          }}
        >
          {i18n('icu:MessageContextMenu__select')}
        </MenuItem>
      )}
      {onCopy && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__copy-timestamp',
          }}
          onClick={() => {
            onCopy();
          }}
        >
          {i18n('icu:copy')}
        </MenuItem>
      )}
      {onMoreInfo && (
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
          {i18n('icu:MessageContextMenu__info')}
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

          onDeleteMessage();
        }}
      >
        {i18n('icu:MessageContextMenu__deleteMessage')}
      </MenuItem>
      {onRetryMessageSend && (
        <MenuItem
          attributes={{
            className:
              'module-message__context--icon module-message__context__retry-send',
          }}
          onClick={(event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();

            onRetryMessageSend();
          }}
        >
          {i18n('icu:retrySend')}
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
          {i18n('icu:retryDeleteForEveryone')}
        </MenuItem>
      )}
    </ContextMenu>
  );

  return ReactDOM.createPortal(menu, document.body);
};

export function useHandleMessageContextMenu(
  menuTriggerRef: RefObject<ContextMenuTriggerType>
): ContextMenuTriggerType['handleContextClick'] {
  return React.useCallback(
    (event: React.MouseEvent<HTMLDivElement> | MouseEvent): void => {
      const selection = window.getSelection();

      if (selection && !selection.isCollapsed) {
        return;
      }
      if (event && event.target instanceof HTMLAnchorElement) {
        return;
      }
      if (menuTriggerRef.current) {
        menuTriggerRef.current.handleContextClick(
          event ?? new MouseEvent('click')
        );
      }
    },
    [menuTriggerRef]
  );
}
