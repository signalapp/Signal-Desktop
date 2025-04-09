// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { memo, useCallback } from 'react';
import type { Placement } from 'react-aria';
import { DialogTrigger } from 'react-aria-components';
import { FunPickerTabKey } from './constants';
import { FunPopover } from './base/FunPopover';
import { FunPickerTab, FunTabList, FunTabPanel, FunTabs } from './base/FunTabs';
import type { FunEmojiSelection } from './panels/FunPanelEmojis';
import { FunPanelEmojis } from './panels/FunPanelEmojis';
import type { FunGifSelection } from './panels/FunPanelGifs';
import { FunPanelGifs } from './panels/FunPanelGifs';
import type { FunStickerSelection } from './panels/FunPanelStickers';
import { FunPanelStickers } from './panels/FunPanelStickers';
import { useFunContext } from './FunProvider';
import type { ThemeType } from '../../types/Util';
import { FunErrorBoundary } from './base/FunErrorBoundary';

/**
 * FunPicker
 */

export type FunPickerProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  onSelectSticker: (stickerSelection: FunStickerSelection) => void;
  onSelectGif: (gifSelection: FunGifSelection) => void;
  onAddStickerPack: (() => void) | null;
  placement?: Placement;
  theme?: ThemeType;
  children: ReactNode;
}>;

export const FunPicker = memo(function FunPicker(
  props: FunPickerProps
): JSX.Element {
  const { onOpenChange } = props;
  const fun = useFunContext();
  const { i18n, onOpenChange: onFunOpenChange } = fun;

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
            <FunErrorBoundary>
              <FunPanelEmojis
                onSelectEmoji={props.onSelectEmoji}
                onClose={handleClose}
                showCustomizePreferredReactionsButton={false}
              />
            </FunErrorBoundary>
          </FunTabPanel>
          <FunTabPanel id={FunPickerTabKey.Stickers}>
            <FunErrorBoundary>
              <FunPanelStickers
                showTimeStickers={false}
                onSelectSticker={props.onSelectSticker}
                onAddStickerPack={props.onAddStickerPack}
                onClose={handleClose}
              />
            </FunErrorBoundary>
          </FunTabPanel>
          <FunTabPanel id={FunPickerTabKey.Gifs}>
            <FunErrorBoundary>
              <FunPanelGifs
                onSelectGif={props.onSelectGif}
                onClose={handleClose}
              />
            </FunErrorBoundary>
          </FunTabPanel>
        </FunTabs>
      </FunPopover>
    </DialogTrigger>
  );
});
