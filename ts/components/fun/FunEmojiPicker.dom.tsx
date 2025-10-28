// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { memo, useCallback } from 'react';
import type { Placement } from 'react-aria';
import { DialogTrigger } from 'react-aria-components';
import { FunPopover } from './base/FunPopover.dom.js';
import type { FunEmojiSelection } from './panels/FunPanelEmojis.dom.js';
import { FunPanelEmojis } from './panels/FunPanelEmojis.dom.js';
import { useFunContext } from './FunProvider.dom.js';
import type { ThemeType } from '../../types/Util.std.js';
import { FunErrorBoundary } from './base/FunErrorBoundary.dom.js';
import type { EmojiVariantKey } from './data/emojis.std.js';

export type FunEmojiPickerProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: Placement;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  theme?: ThemeType;
  showCustomizePreferredReactionsButton?: boolean;
  closeOnSelect: boolean;
  children: ReactNode;
  messageEmojis?: ReadonlyArray<EmojiVariantKey>;
}>;

export const FunEmojiPicker = memo(function FunEmojiPicker(
  props: FunEmojiPickerProps
): JSX.Element {
  const { onOpenChange } = props;
  const fun = useFunContext();
  const { onOpenChange: onFunOpenChange } = fun;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      onFunOpenChange(open);
    },
    [onOpenChange, onFunOpenChange]
  );

  const handleClose = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  return (
    <DialogTrigger isOpen={props.open} onOpenChange={handleOpenChange}>
      {props.children}
      <FunPopover placement={props.placement} theme={props.theme}>
        <FunErrorBoundary>
          <FunPanelEmojis
            onSelectEmoji={props.onSelectEmoji}
            onClose={handleClose}
            showCustomizePreferredReactionsButton={
              props.showCustomizePreferredReactionsButton ?? false
            }
            closeOnSelect={props.closeOnSelect}
            messageEmojis={props.messageEmojis}
          />
        </FunErrorBoundary>
      </FunPopover>
    </DialogTrigger>
  );
});
