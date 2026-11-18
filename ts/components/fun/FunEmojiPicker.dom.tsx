// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX } from 'react';
import { memo, useCallback, useId } from 'react';
import { Popover } from 'radix-ui';
import {
  FunPopover,
  type FunPopoverPlacement,
} from './base/FunPopover.dom.tsx';
import type { FunEmojiSelection } from './panels/FunPanelEmojis.dom.tsx';
import { FunPanelEmojis } from './panels/FunPanelEmojis.dom.tsx';
import { useFunContext } from './FunProvider.dom.tsx';
import type { ThemeType } from '../../types/Util.std.ts';
import { FunErrorBoundary } from './base/FunErrorBoundary.dom.tsx';
import type { Emoji } from '../../axo/emoji.std.ts';

export type FunEmojiPickerProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: FunPopoverPlacement;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  theme?: ThemeType;
  showCustomizePreferredReactionsButton?: boolean;
  closeOnSelect: boolean;
  children: ReactNode;
  messageEmojis?: ReadonlyArray<Emoji.Variant>;
}>;

export const FunEmojiPicker = memo(function FunEmojiPicker(
  props: FunEmojiPickerProps
): JSX.Element {
  const { onOpenChange } = props;
  const fun = useFunContext();
  const triggerId = useId();
  const { onAnyOpenChange } = fun;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange(open);
      onAnyOpenChange(open);
    },
    [onOpenChange, onAnyOpenChange]
  );

  const handleClose = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  return (
    <Popover.Root open={props.open} onOpenChange={handleOpenChange} modal>
      <Popover.Trigger id={triggerId} asChild>
        {props.children}
      </Popover.Trigger>
      <FunPopover
        aria-labelledby={triggerId}
        placement={props.placement}
        theme={props.theme}
      >
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
    </Popover.Root>
  );
});
