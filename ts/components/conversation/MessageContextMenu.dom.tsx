// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, type ReactNode } from 'react';
import type { LocalizerType } from '../../types/I18N.std.js';
import { AxoMenuBuilder } from '../../axo/AxoMenuBuilder.dom.js';
import { isInternalFeaturesEnabled } from '../../util/isInternalFeaturesEnabled.dom.js';
import type { EmojiVariantKey } from '../fun/data/emojis.std.js';
import { tw } from '../../axo/tw.dom.js';
import type { SmartReactionPicker } from '../../state/smart/ReactionPicker.dom.js';

type MessageContextMenuProps = Readonly<{
  i18n: LocalizerType;
  renderer: AxoMenuBuilder.Renderer;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  onDebugMessage: (() => void) | null;
  onDownload: (() => void) | null;
  onEdit: (() => void) | null;
  onReplyToMessage: (() => void) | null;
  onReact?: (() => void) | null;
  onEndPoll: (() => void) | null;
  onRetryMessageSend: (() => void) | null;
  onRetryDeleteForEveryone: (() => void) | null;
  onCopy: (() => void) | null;
  onForward: (() => void) | null;
  onDeleteMessage: (() => void) | null;
  onPinMessage: (() => void) | null;
  onUnpinMessage: (() => void) | null;
  onMoreInfo: (() => void) | null;
  onSelect: (() => void) | null;
  onPickEmoji: (emoji: string) => void;
  onShowFullPicker: () => void;
  renderReactionPicker: (
    props: React.ComponentProps<typeof SmartReactionPicker>
  ) => React.JSX.Element;
  selectedReaction?: string;
  messageEmojis?: ReadonlyArray<EmojiVariantKey>;
  children: ReactNode;
}>;

export function MessageContextMenu({
  i18n,
  renderer,
  onOpenChange,
  disabled,
  onDebugMessage,
  onDownload,
  onEdit,
  onReplyToMessage,
  onRetryMessageSend,
  onRetryDeleteForEveryone,
  onForward,
  onDeleteMessage,
  onPinMessage,
  onUnpinMessage,
  onEndPoll,
  onMoreInfo,
  onCopy,
  onSelect,
  onPickEmoji,
  onShowFullPicker,
  renderReactionPicker,
  selectedReaction,
  messageEmojis,
  children,
}: MessageContextMenuProps): React.JSX.Element {
  const shouldReturnFocusToTrigger = useRef(true);

  return (
    <AxoMenuBuilder.Root renderer={renderer} onOpenChange={onOpenChange}>
      <AxoMenuBuilder.Trigger disabled={disabled}>
        {children}
      </AxoMenuBuilder.Trigger>
      <AxoMenuBuilder.Content
        className={tw('!overflow-visible')}
        onCloseAutoFocus={e => {
          if (!shouldReturnFocusToTrigger.current) {
            e.preventDefault();
          }
        }}
      >
        <div className={tw('col-span-full border-b-[0.5px] border-border-primary pb-0.5 pt-0.5 px-0 overflow-visible')}>
          {renderReactionPicker({
            onPick: (emoji: string) => {
              onPickEmoji(emoji);
              // Trigger escape to close the menu
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            },
            onMore: () => {
              onShowFullPicker();
              // Trigger escape to close the menu
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            },
            onClose: () => {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            },
            selected: selectedReaction,
            messageEmojis,
            style: { 
              borderRadius: 'var(--curved-xl)',
              width: '100%',
              boxShadow: 'none',
              backgroundColor: 'transparent',
              overflow: 'visible',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: 'none',
              paddingInline: 0,
            }
          })}
        </div>
        {onDownload && (
          <AxoMenuBuilder.Item symbol="download" onSelect={onDownload}>
            {i18n('icu:MessageContextMenu__download')}
          </AxoMenuBuilder.Item>
        )}
        {onReplyToMessage && (
          <AxoMenuBuilder.Item
            symbol="reply"
            onSelect={() => {
              // onReplyToMessage will focus the quill input
              shouldReturnFocusToTrigger.current = false;
              onReplyToMessage();
            }}
          >
            {i18n('icu:MessageContextMenu__reply')}
          </AxoMenuBuilder.Item>
        )}
        {onEndPoll && (
          <AxoMenuBuilder.Item symbol="stop-circle" onSelect={onEndPoll}>
            {i18n('icu:Poll__end-poll')}
          </AxoMenuBuilder.Item>
        )}
        {onForward && (
          <AxoMenuBuilder.Item
            symbol="forward"
            onSelect={() => {
              // forward modal takes focus
              shouldReturnFocusToTrigger.current = false;
              onForward();
            }}
          >
            {i18n('icu:MessageContextMenu__forward')}
          </AxoMenuBuilder.Item>
        )}
        {onEdit && (
          <AxoMenuBuilder.Item
            symbol="pencil"
            onSelect={() => {
              // onEdit will focus the quill input
              shouldReturnFocusToTrigger.current = false;
              onEdit();
            }}
          >
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
        {onPinMessage && (
          <AxoMenuBuilder.Item symbol="pin" onSelect={onPinMessage}>
            {i18n('icu:MessageContextMenu__PinMessage')}
          </AxoMenuBuilder.Item>
        )}
        {onUnpinMessage && (
          <AxoMenuBuilder.Item symbol="pin-slash" onSelect={onUnpinMessage}>
            {i18n('icu:MessageContextMenu__UnpinMessage')}
          </AxoMenuBuilder.Item>
        )}
        {onMoreInfo && (
          <AxoMenuBuilder.Item symbol="info" onSelect={onMoreInfo}>
            {i18n('icu:MessageContextMenu__info')}
          </AxoMenuBuilder.Item>
        )}
        {onDeleteMessage && (
          <AxoMenuBuilder.Item
            symbol="trash"
            onSelect={onDeleteMessage}
            variant="destructive"
          >
            {i18n('icu:MessageContextMenu__deleteMessage')}
          </AxoMenuBuilder.Item>
        )}
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
        {isInternalFeaturesEnabled() && onDebugMessage && (
          <>
            <AxoMenuBuilder.Separator />
            <AxoMenuBuilder.Group>
              <AxoMenuBuilder.Label>Internal</AxoMenuBuilder.Label>
              <AxoMenuBuilder.Item symbol="copy" onSelect={onDebugMessage}>
                Copy & debug message
              </AxoMenuBuilder.Item>
            </AxoMenuBuilder.Group>
          </>
        )}
      </AxoMenuBuilder.Content>
    </AxoMenuBuilder.Root>
  );
}
