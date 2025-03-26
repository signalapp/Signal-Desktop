// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { memo, useCallback, useEffect, useState } from 'react';
import type { Placement } from 'react-aria';
import { DialogTrigger } from 'react-aria-components';
import { FunPopover } from './base/FunPopover';
import type { FunStickerSelection } from './panels/FunPanelStickers';
import { FunPanelStickers } from './panels/FunPanelStickers';
import { useFunContext } from './FunProvider';

export type FunStickerPickerProps = Readonly<{
  placement?: Placement;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;
  children: ReactNode;
}>;

export const FunStickerPicker = memo(function FunStickerPicker(
  props: FunStickerPickerProps
): JSX.Element {
  const { onOpenChange } = props;
  const fun = useFunContext();
  const { onClose } = fun;
  const [isOpen, setIsOpen] = useState(props.defaultOpen ?? false);

  const handleOpenChange = useCallback(
    (nextIsOpen: boolean) => {
      setIsOpen(nextIsOpen);
      onOpenChange?.(nextIsOpen);
    },
    [onOpenChange]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      {props.children}
      <FunPopover placement={props.placement}>
        <FunPanelStickers
          onSelectSticker={props.onSelectSticker}
          onClose={handleClose}
          onAddStickerPack={null}
        />
      </FunPopover>
    </DialogTrigger>
  );
});
