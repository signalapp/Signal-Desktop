// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { memo, useCallback, useState } from 'react';
import type { Placement } from 'react-aria';
import { DialogTrigger } from 'react-aria-components';
import { FunPickerTabKey } from './FunConstants';
import { FunPopover } from './base/FunPopover';
import { FunPickerTab, FunTabList, FunTabPanel, FunTabs } from './base/FunTabs';
import type { FunEmojiSelection } from './panels/FunPanelEmojis';
import { FunPanelEmojis } from './panels/FunPanelEmojis';
import type { FunGifSelection } from './panels/FunPanelGifs';
import { FunPanelGifs } from './panels/FunPanelGifs';
import type { FunStickerSelection } from './panels/FunPanelStickers';
import { FunPanelStickers } from './panels/FunPanelStickers';
import { useFunContext } from './FunProvider';

/**
 * FunPicker
 */

export type FunPickerProps = Readonly<{
  placement?: Placement;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;
  onSelectGif: (gifSelection: FunGifSelection) => void;
  onAddStickerPack: (() => void) | null;
  children: ReactNode;
}>;

export const FunPicker = memo(function FunPicker(
  props: FunPickerProps
): JSX.Element {
  const { onOpenChange } = props;
  const fun = useFunContext();
  const { i18n } = fun;

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

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      {props.children}
      <FunPopover placement={props.placement}>
        <FunTabs value={fun.tab} onChange={fun.onChangeTab}>
          <FunTabList>
            <FunPickerTab id={FunPickerTabKey.Emoji}>
              {i18n('icu:FunPicker__Tab--Emojis')}
            </FunPickerTab>
            <FunPickerTab id={FunPickerTabKey.Stickers}>
              {i18n('icu:FunPicker__Tab--Stickers')}
            </FunPickerTab>
            <FunPickerTab id={FunPickerTabKey.Gifs}>
              {i18n('icu:FunPicker__Tab--Gifs')}
            </FunPickerTab>
          </FunTabList>
          <FunTabPanel id={FunPickerTabKey.Emoji}>
            <FunPanelEmojis
              onEmojiSelect={props.onSelectEmoji}
              onClose={handleClose}
            />
          </FunTabPanel>
          <FunTabPanel id={FunPickerTabKey.Stickers}>
            <FunPanelStickers
              onSelectSticker={props.onSelectSticker}
              onAddStickerPack={props.onAddStickerPack}
              onClose={handleClose}
            />
          </FunTabPanel>
          <FunTabPanel id={FunPickerTabKey.Gifs}>
            <FunPanelGifs
              onSelectGif={props.onSelectGif}
              onClose={handleClose}
            />
          </FunTabPanel>
        </FunTabs>
      </FunPopover>
    </DialogTrigger>
  );
});
