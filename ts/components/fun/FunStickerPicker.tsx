// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { memo, useCallback } from 'react';
import type { Placement } from 'react-aria';
import { DialogTrigger } from 'react-aria-components';
import { FunPopover } from './base/FunPopover';
import type { FunStickerSelection } from './panels/FunPanelStickers';
import { FunPanelStickers } from './panels/FunPanelStickers';
import { useFunContext } from './FunProvider';
import type { ThemeType } from '../../types/Util';

export type FunStickerPickerProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;
  placement?: Placement;
  theme?: ThemeType;
  children: ReactNode;
}>;

export const FunStickerPicker = memo(function FunStickerPicker(
  props: FunStickerPickerProps
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
        <FunPanelStickers
          onSelectSticker={props.onSelectSticker}
          onClose={handleClose}
          onAddStickerPack={null}
        />
      </FunPopover>
    </DialogTrigger>
  );
});
