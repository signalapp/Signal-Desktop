// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { memo, useCallback, useEffect } from 'react';
import type { Placement } from 'react-aria';
import { DialogTrigger } from 'react-aria-components';
import { createKeybindingsHandler } from 'tinykeys';
import { FunPickerTabKey } from './constants.dom.js';
import { FunPopover } from './base/FunPopover.dom.js';
import {
  FunPickerTab,
  FunTabList,
  FunTabPanel,
  FunTabs,
} from './base/FunTabs.dom.js';
import type { FunEmojiSelection } from './panels/FunPanelEmojis.dom.js';
import { FunPanelEmojis } from './panels/FunPanelEmojis.dom.js';
import type { FunGifSelection } from './panels/FunPanelGifs.dom.js';
import { FunPanelGifs } from './panels/FunPanelGifs.dom.js';
import type { FunStickerSelection } from './panels/FunPanelStickers.dom.js';
import { FunPanelStickers } from './panels/FunPanelStickers.dom.js';
import { useFunContext } from './FunProvider.dom.js';
import type { ThemeType } from '../../types/Util.std.js';
import { FunErrorBoundary } from './base/FunErrorBoundary.dom.js';

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
  const { i18n, onOpenChange: onFunOpenChange, onChangeTab } = fun;

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

  useEffect(() => {
    const onKeyDown = createKeybindingsHandler({
      '$mod+Shift+J': () => {
        onChangeTab(FunPickerTabKey.Emoji);
        handleOpenChange(true);
      },
      '$mod+Shift+O': () => {
        onChangeTab(FunPickerTabKey.Stickers);
        handleOpenChange(true);
      },
      '$mod+Shift+G': () => {
        onChangeTab(FunPickerTabKey.Gifs);
        handleOpenChange(true);
      },
    });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleOpenChange, onChangeTab]);

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
                closeOnSelect={false}
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
