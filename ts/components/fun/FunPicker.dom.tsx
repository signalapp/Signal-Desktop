// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { Dialog } from 'radix-ui';
import type { ReactNode, JSX } from 'react';
import { memo, useCallback, useEffect, useEffectEvent } from 'react';
import { type Placement, VisuallyHidden } from 'react-aria';
import { DialogTrigger } from 'react-aria-components';
import { tinykeys } from 'tinykeys';
import { FunPickerTabKey } from './constants.dom.tsx';
import { FunPopover } from './base/FunPopover.dom.tsx';
import {
  FunPickerTab,
  FunTabList,
  FunTabPanel,
  FunTabs,
} from './base/FunTabs.dom.tsx';
import type { FunEmojiSelection } from './panels/FunPanelEmojis.dom.tsx';
import { FunPanelEmojis } from './panels/FunPanelEmojis.dom.tsx';
import type { FunGifSelection } from './panels/FunPanelGifs.dom.tsx';
import { FunPanelGifs } from './panels/FunPanelGifs.dom.tsx';
import type { FunStickerSelection } from './panels/FunPanelStickers.dom.tsx';
import { FunPanelStickers } from './panels/FunPanelStickers.dom.tsx';
import { useFunContext } from './FunProvider.dom.tsx';
import type { ThemeType } from '../../types/Util.std.ts';
import { FunErrorBoundary } from './base/FunErrorBoundary.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { FunSticker } from './FunSticker.dom.tsx';
import { AxoIconButton } from '../../axo/AxoIconButton.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { tw } from '../../axo/tw.dom.tsx';

/**
 * FunPicker
 */

export type FunPickerProps = Readonly<{
  open: boolean;
  isReply: boolean;
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
  const { isReply, onOpenChange, onSelectSticker } = props;
  const fun = useFunContext();
  const {
    i18n,
    isStickerReplySendEnabled,
    stagedStickerReply,
    onAnyOpenChange,
    onSelectSticker: onFunSelectSticker,
    onChangeTab,
    onStageStickerReply,
  } = fun;

  const isReplyForFunPanel = isStickerReplySendEnabled && isReply;

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

  const handleCancelStickerReply = useCallback(() => {
    onStageStickerReply(null);
  }, [onStageStickerReply]);

  const handleSendStickerReply = useCallback(() => {
    strictAssert(stagedStickerReply, 'Staged sticker reply is required');

    onFunSelectSticker(stagedStickerReply);
    onSelectSticker(stagedStickerReply);
    handleClose();
  }, [stagedStickerReply, handleClose, onFunSelectSticker, onSelectSticker]);

  const onSelectEmojisTabShortcut = useEffectEvent((event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChangeTab(FunPickerTabKey.EmojisTab);
    handleOpenChange(true);
  });

  const onSelectStickersTabShortcut = useEffectEvent((event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChangeTab(FunPickerTabKey.StickersTab);
    handleOpenChange(true);
  });

  const onSelectGifsTabShortcut = useEffectEvent((event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChangeTab(FunPickerTabKey.GifsTab);
    handleOpenChange(true);
  });

  useEffect(() => {
    return tinykeys(
      window,
      {
        '$mod+Shift+J': onSelectEmojisTabShortcut,
        '$mod+Shift+O': onSelectStickersTabShortcut,
        '$mod+Shift+G': onSelectGifsTabShortcut,
      },
      {
        // Override default ignore so shortcuts work while textboxes are focused
        ignore: () => false,
      }
    );
  }, []);

  return (
    <DialogTrigger isOpen={props.open} onOpenChange={handleOpenChange}>
      {props.children}
      <FunPopover placement={props.placement} theme={props.theme}>
        <FunTabs value={fun.tab} onChange={fun.onChangeTab}>
          <StagedStickerReply
            i18n={i18n}
            selection={stagedStickerReply}
            handleCancelStickerReply={handleCancelStickerReply}
            handleSendStickerReply={handleSendStickerReply}
          />
          <FunTabList>
            <FunPickerTab id={FunPickerTabKey.EmojisTab}>
              {i18n('icu:FunPicker__Tab--Emojis')}
            </FunPickerTab>
            <FunPickerTab id={FunPickerTabKey.StickersTab}>
              {i18n('icu:FunPicker__Tab--Stickers')}
            </FunPickerTab>
            <FunPickerTab id={FunPickerTabKey.GifsTab}>
              {i18n('icu:FunPicker__Tab--Gifs')}
            </FunPickerTab>
          </FunTabList>
          <FunTabPanel id={FunPickerTabKey.EmojisTab}>
            <FunErrorBoundary>
              <FunPanelEmojis
                onSelectEmoji={props.onSelectEmoji}
                onClose={handleClose}
                showCustomizePreferredReactionsButton={false}
                closeOnSelect={false}
              />
            </FunErrorBoundary>
          </FunTabPanel>
          <FunTabPanel id={FunPickerTabKey.StickersTab}>
            <FunErrorBoundary>
              <FunPanelStickers
                isReply={isReplyForFunPanel}
                showTimeStickers={false}
                onSelectSticker={props.onSelectSticker}
                onAddStickerPack={props.onAddStickerPack}
                onClose={handleClose}
              />
            </FunErrorBoundary>
          </FunTabPanel>
          <FunTabPanel id={FunPickerTabKey.GifsTab}>
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

const StagedStickerReply = memo(function StagedStickerReply(props: {
  i18n: LocalizerType;
  selection: FunStickerSelection | null;
  handleCancelStickerReply: () => void;
  handleSendStickerReply: () => void;
}): JSX.Element | null {
  const { i18n, selection, handleCancelStickerReply, handleSendStickerReply } =
    props;
  if (!selection) {
    return null;
  }

  return (
    <Dialog.Root modal={false} open onOpenChange={handleCancelStickerReply}>
      <Dialog.Content onEscapeKeyDown={event => event.stopPropagation()}>
        <div
          className={tw(
            'absolute legacy-z-index-above-above-base flex size-full items-center justify-center bg-material-primary backdrop-blur-thick'
          )}
        >
          <div className={tw('size-50')}>
            <FunSticker
              role="img"
              aria-label={i18n('icu:FunPicker__Label--Sticker')}
              src={selection.stickerUrl}
              size={200}
              ignoreReducedMotion
            />
          </div>
          <div className={tw('absolute bottom-0 flex w-full items-center p-4')}>
            <AxoIconButton.Root
              size="md"
              variant="strong-secondary"
              symbol="x"
              label={i18n('icu:FunPicker__Label--CancelStickerReply')}
              onClick={handleCancelStickerReply}
              tooltip={false}
            />
            <span
              className={tw(
                'flex grow justify-center type-body-medium font-medium text-secondary'
              )}
            >
              <AxoSymbol.InlineGlyph symbol="reply" label={null} />
              &nbsp;
              {i18n('icu:FunPicker__Label--StickerReply')}
            </span>
            <AxoIconButton.Root
              size="md"
              variant="strong-primary"
              symbol="send-fill"
              label={i18n('icu:FunPicker__Label--SendStickerReply')}
              onClick={handleSendStickerReply}
              tooltip={false}
            />
          </div>
        </div>
        <VisuallyHidden>
          <Dialog.Title>
            {i18n('icu:FunPicker__Label--StickerReply')}
          </Dialog.Title>
        </VisuallyHidden>
      </Dialog.Content>
    </Dialog.Root>
  );
});
