// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX } from 'react';
import { memo, useCallback, useId } from 'react';
import { Popover } from 'radix-ui';
import {
  FunPopover,
  type FunPopoverPlacement,
} from './base/FunPopover.dom.tsx';
import type { FunStickerSelection } from './panels/FunPanelStickers.dom.tsx';
import { FunPanelStickers } from './panels/FunPanelStickers.dom.tsx';
import { useFunContext } from './FunProvider.dom.tsx';
import type { ThemeType } from '../../types/Util.std.ts';
import { FunErrorBoundary } from './base/FunErrorBoundary.dom.tsx';
import type { FunTimeStickerStyle } from './constants.dom.tsx';

export type FunStickerPickerProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTimeStickers: boolean;
  onSelectTimeSticker?: (style: FunTimeStickerStyle) => void;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;
  onMarkStickerAsFavorite: (
    stickerSelection: FunStickerSelection,
    markAsFavorite: boolean
  ) => void;
  placement?: FunPopoverPlacement;
  theme?: ThemeType;
  children: ReactNode;
}>;

export const FunStickerPicker = memo(function FunStickerPicker(
  props: FunStickerPickerProps
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
          <FunPanelStickers
            showTimeStickers={props.showTimeStickers}
            onSelectTimeSticker={props.onSelectTimeSticker}
            onSelectSticker={props.onSelectSticker}
            onClose={handleClose}
            onAddStickerPack={null}
            onMarkStickerAsFavorite={props.onMarkStickerAsFavorite}
          />
        </FunErrorBoundary>
      </FunPopover>
    </Popover.Root>
  );
});
