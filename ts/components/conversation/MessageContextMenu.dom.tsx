// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode } from 'react';
import type { LocalizerType } from '../../types/I18N.std.js';
import { AxoMenuBuilder } from '../../axo/AxoMenuBuilder.dom.js';

export type ContextMenuTriggerType = {
  handleContextClick: (
    event: React.MouseEvent<HTMLDivElement> | MouseEvent
  ) => void;
};

type MessageContextMenuProps = Readonly<{
  i18n: LocalizerType;
  renderer: AxoMenuBuilder.Renderer;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  shouldShowAdditional: boolean;
  onDownload: (() => void) | undefined;
  onEdit: (() => void) | undefined;
  onReplyToMessage: (() => void) | undefined;
  onReact: (() => void) | undefined;
  onEndPoll: (() => void) | undefined;
  onRetryMessageSend: (() => void) | undefined;
  onRetryDeleteForEveryone: (() => void) | undefined;
  onCopy: (() => void) | undefined;
  onForward: (() => void) | undefined;
  onDeleteMessage: () => void;
  onMoreInfo: (() => void) | undefined;
  onSelect: (() => void) | undefined;
  children: ReactNode;
}>;

export function MessageContextMenu({
  i18n,
  renderer,
  onOpenChange,
  disabled,
  shouldShowAdditional,
  onDownload,
  onEdit,
  onReplyToMessage,
  onReact,
  onEndPoll,
  onMoreInfo,
  onCopy,
  onSelect,
  onRetryMessageSend,
  onRetryDeleteForEveryone,
  onForward,
  onDeleteMessage,
  children,
}: MessageContextMenuProps): JSX.Element {
  return (
    <AxoMenuBuilder.Root renderer={renderer} onOpenChange={onOpenChange}>
      <AxoMenuBuilder.Trigger disabled={disabled}>
        {children}
      </AxoMenuBuilder.Trigger>
      <AxoMenuBuilder.Content>
        {shouldShowAdditional && (
          <>
            {onDownload && (
              <AxoMenuBuilder.Item symbol="download" onSelect={onDownload}>
                {i18n('icu:MessageContextMenu__download')}
              </AxoMenuBuilder.Item>
            )}
            {onReplyToMessage && (
              <AxoMenuBuilder.Item symbol="reply" onSelect={onReplyToMessage}>
                {i18n('icu:MessageContextMenu__reply')}
              </AxoMenuBuilder.Item>
            )}
            {onReact && (
              <AxoMenuBuilder.Item symbol="heart-plus" onSelect={onReact}>
                {i18n('icu:MessageContextMenu__react')}
              </AxoMenuBuilder.Item>
            )}
          </>
        )}
        {onEndPoll && (
          <AxoMenuBuilder.Item symbol="stop-circle" onSelect={onEndPoll}>
            {i18n('icu:Poll__end-poll')}
          </AxoMenuBuilder.Item>
        )}
        {onForward && (
          <AxoMenuBuilder.Item symbol="forward" onSelect={onForward}>
            {i18n('icu:MessageContextMenu__forward')}
          </AxoMenuBuilder.Item>
        )}
        {onEdit && (
          <AxoMenuBuilder.Item symbol="pencil" onSelect={onEdit}>
            {i18n('icu:edit')}
          </AxoMenuBuilder.Item>
        )}
        {onSelect && (
          <AxoMenuBuilder.Item symbol="check-circle" onSelect={onSelect}>
            {i18n('icu:MessageContextMenu__select')}
          </AxoMenuBuilder.Item>
        )}
        {onCopy && (
          <AxoMenuBuilder.Item symbol="copy" onSelect={onCopy}>
            {i18n('icu:copy')}
          </AxoMenuBuilder.Item>
        )}
        {onMoreInfo && (
          <AxoMenuBuilder.Item symbol="info" onSelect={onMoreInfo}>
            {i18n('icu:MessageContextMenu__info')}
          </AxoMenuBuilder.Item>
        )}
        <AxoMenuBuilder.Item symbol="trash" onSelect={onDeleteMessage}>
          {i18n('icu:MessageContextMenu__deleteMessage')}
        </AxoMenuBuilder.Item>
        {onRetryMessageSend && (
          <AxoMenuBuilder.Item symbol="send" onSelect={onRetryMessageSend}>
            {i18n('icu:retrySend')}
          </AxoMenuBuilder.Item>
        )}
        {onRetryDeleteForEveryone && (
          <AxoMenuBuilder.Item
            symbol="trash"
            onSelect={onRetryDeleteForEveryone}
          >
            {i18n('icu:retryDeleteForEveryone')}
          </AxoMenuBuilder.Item>
        )}
      </AxoMenuBuilder.Content>
    </AxoMenuBuilder.Root>
  );
}
