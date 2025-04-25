// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { get, noop } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';

import type { StickerPackType, StickerType } from '../../state/ducks/stickers';
import type { LocalizerType } from '../../types/Util';
import type { Theme } from '../../util/theme';
import { StickerPicker } from './StickerPicker';
import { countStickers } from './lib';
import { offsetDistanceModifier } from '../../util/popperUtil';
import { themeClassName } from '../../util/theme';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import * as KeyboardLayout from '../../services/keyboardLayout';
import { useRefMerger } from '../../hooks/useRefMerger';
import { UserText } from '../UserText';

export type OwnProps = {
  readonly className?: string;
  readonly i18n: LocalizerType;
  readonly receivedPacks: ReadonlyArray<StickerPackType>;
  readonly installedPacks: ReadonlyArray<StickerPackType>;
  readonly blessedPacks: ReadonlyArray<StickerPackType>;
  readonly knownPacks: ReadonlyArray<StickerPackType>;
  readonly installedPack?: StickerPackType | null;
  readonly recentStickers: ReadonlyArray<StickerType>;
  readonly onOpenStateChanged?: (isOpen: boolean) => void;
  readonly clearInstalledStickerPack: () => unknown;
  readonly onClickAddPack?: () => unknown;
  readonly onPickSticker: (
    packId: string,
    stickerId: number,
    url: string
  ) => unknown;
  readonly onPickTimeSticker?: (style: 'analog' | 'digital') => unknown;
  readonly showIntroduction?: boolean;
  readonly clearShowIntroduction: () => unknown;
  readonly showPickerHint: boolean;
  readonly clearShowPickerHint: () => unknown;
  readonly position?: 'top-end' | 'top-start';
  readonly theme?: Theme;
};

export type Props = OwnProps;

export const StickerButton = React.memo(function StickerButtonInner({
  className,
  i18n,
  clearInstalledStickerPack,
  onClickAddPack,
  onPickSticker,
  onPickTimeSticker,
  recentStickers,
  onOpenStateChanged,
  receivedPacks,
  installedPack,
  installedPacks,
  blessedPacks,
  knownPacks,
  showIntroduction,
  clearShowIntroduction,
  showPickerHint,
  clearShowPickerHint,
  position = 'top-end',
  theme,
}: Props) {
  const [open, internalSetOpen] = React.useState(false);

  const setOpen = React.useCallback(
    (value: boolean) => {
      internalSetOpen(value);
      if (onOpenStateChanged) {
        onOpenStateChanged(value);
      }
    },
    [internalSetOpen, onOpenStateChanged]
  );

  const [popperRoot, setPopperRoot] = React.useState<HTMLElement | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const refMerger = useRefMerger();

  const handleClickButton = React.useCallback(() => {
    // Clear tooltip state
    clearInstalledStickerPack();
    clearShowIntroduction();

    // Handle button click
    if (installedPacks.length === 0) {
      onClickAddPack?.();
    } else if (popperRoot) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [
    clearInstalledStickerPack,
    clearShowIntroduction,
    installedPacks,
    onClickAddPack,
    popperRoot,
    setOpen,
  ]);

  const handlePickSticker = React.useCallback(
    (packId: string, stickerId: number, url: string) => {
      setOpen(false);
      onPickSticker(packId, stickerId, url);
    },
    [setOpen, onPickSticker]
  );

  const handlePickTimeSticker = React.useCallback(
    (style: 'analog' | 'digital') => {
      setOpen(false);
      onPickTimeSticker?.(style);
    },
    [setOpen, onPickTimeSticker]
  );

  const handleClose = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const handleClickAddPack = React.useCallback(() => {
    setOpen(false);
    if (showPickerHint) {
      clearShowPickerHint();
    }
    onClickAddPack?.();
  }, [onClickAddPack, showPickerHint, setOpen, clearShowPickerHint]);

  const handleClearIntroduction = React.useCallback(() => {
    clearInstalledStickerPack();
    clearShowIntroduction();
  }, [clearInstalledStickerPack, clearShowIntroduction]);

  // Keyboard shortcut handler for opening/closing sticker picker
  // Uses Command/Ctrl + Shift + G to toggle the sticker picker
  // This matches the shortcut defined in ShortcutGuide.tsx
  React.useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const { ctrlKey, metaKey, shiftKey } = event;
      const commandKey = get(window, 'platform') === 'darwin' && metaKey;
      const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
      const commandOrCtrl = commandKey || controlKey;
      const key = KeyboardLayout.lookup(event);

      // We don't want to open up if the conversation has any panels open
      const panels = document.querySelectorAll('.conversation .panel');
      if (panels && panels.length > 1) {
        return;
      }

      if (commandOrCtrl && shiftKey && (key === 'g' || key === 'G')) {
        event.stopPropagation();
        event.preventDefault();

        setOpen(!open);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [open, setOpen]);

  // Create popper root and handle outside clicks
  React.useEffect(() => {
    if (open) {
      const root = document.createElement('div');
      setPopperRoot(root);
      document.body.appendChild(root);

      return () => {
        document.body.removeChild(root);
        setPopperRoot(null);
      };
    }

    return noop;
  }, [open, setOpen, setPopperRoot]);

  React.useEffect(() => {
    if (!open) {
      return noop;
    }

    return handleOutsideClick(
      target => {
        const targetElement = target as HTMLElement;
        const targetClassName = targetElement
          ? targetElement.className || ''
          : '';

        // We need to special-case sticker picker header buttons, because they can
        //   disappear after being clicked, which breaks the .contains() check below.
        const isMissingButtonClass =
          !targetClassName ||
          targetClassName.indexOf('module-sticker-picker__header__button') < 0;

        if (!isMissingButtonClass) {
          return false;
        }

        setOpen(false);
        return true;
      },
      {
        containerElements: [popperRoot, buttonRef],
        name: 'StickerButton',
      }
    );
  }, [open, popperRoot, setOpen]);

  // Clear the installed pack after one minute
  React.useEffect(() => {
    if (installedPack) {
      const timerId = setTimeout(clearInstalledStickerPack, 10 * 1000);

      return () => {
        clearTimeout(timerId);
      };
    }

    return noop;
  }, [installedPack, clearInstalledStickerPack]);

  if (
    countStickers({
      knownPacks,
      blessedPacks,
      installedPacks,
      receivedPacks,
    }) === 0
  ) {
    return null;
  }

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <button
            type="button"
            ref={refMerger(buttonRef, ref)}
            onClick={handleClickButton}
            className={classNames(
              {
                'module-sticker-button__button': true,
                'module-sticker-button__button--active': open,
              },
              className
            )}
            aria-label={i18n('icu:stickers--StickerPicker--Open')}
          />
        )}
      </Reference>
      {!open && !showIntroduction && installedPack ? (
        <Popper
          placement={position}
          key={installedPack.id}
          modifiers={[offsetDistanceModifier(6)]}
        >
          {({ ref, style, placement, arrowProps }) => (
            <div className={theme ? themeClassName(theme) : undefined}>
              <button
                type="button"
                ref={ref}
                style={style}
                className="module-sticker-button__tooltip"
                onClick={clearInstalledStickerPack}
              >
                {installedPack.cover ? (
                  <img
                    className="module-sticker-button__tooltip__image"
                    src={installedPack.cover.url}
                    alt={installedPack.title}
                  />
                ) : (
                  <div className="module-sticker-button__tooltip__image-placeholder" />
                )}
                <span className="module-sticker-button__tooltip__text">
                  <span className="module-sticker-button__tooltip__text__title">
                    <UserText text={installedPack.title} />
                  </span>{' '}
                  installed
                </span>
                <div
                  ref={arrowProps.ref}
                  style={arrowProps.style}
                  className={classNames(
                    'module-sticker-button__tooltip__triangle',
                    `module-sticker-button__tooltip__triangle--${placement}`
                  )}
                />
              </button>
            </div>
          )}
        </Popper>
      ) : null}
      {!open && showIntroduction ? (
        <Popper placement={position} modifiers={[offsetDistanceModifier(6)]}>
          {({ ref, style, placement, arrowProps }) => (
            <div className={theme ? themeClassName(theme) : undefined}>
              <button
                type="button"
                ref={ref}
                style={style}
                className={classNames(
                  'module-sticker-button__tooltip',
                  'module-sticker-button__tooltip--introduction'
                )}
                onClick={handleClearIntroduction}
              >
                <img
                  className="module-sticker-button__tooltip--introduction__image"
                  srcSet="images/sticker_splash@1x.png 1x, images/sticker_splash@2x.png 2x"
                  alt={i18n(
                    'icu:stickers--StickerManager--Introduction--Image'
                  )}
                />
                <div className="module-sticker-button__tooltip--introduction__meta">
                  <div className="module-sticker-button__tooltip--introduction__meta__title">
                    {i18n('icu:stickers--StickerManager--Introduction--Title')}
                  </div>
                  <div className="module-sticker-button__tooltip--introduction__meta__subtitle">
                    {i18n('icu:stickers--StickerManager--Introduction--Body')}
                  </div>
                </div>
                <div className="module-sticker-button__tooltip--introduction__close">
                  <button
                    type="button"
                    className="module-sticker-button__tooltip--introduction__close__button"
                    onClick={handleClearIntroduction}
                    aria-label={i18n('icu:close')}
                  />
                </div>
                <div
                  ref={arrowProps.ref}
                  style={arrowProps.style}
                  className={classNames(
                    'module-sticker-button__tooltip__triangle',
                    'module-sticker-button__tooltip__triangle--introduction',
                    `module-sticker-button__tooltip__triangle--${placement}`
                  )}
                />
              </button>
            </div>
          )}
        </Popper>
      ) : null}
      {open && popperRoot
        ? createPortal(
            <Popper placement={position}>
              {({ ref, style }) => (
                <div className={theme ? themeClassName(theme) : undefined}>
                  <StickerPicker
                    ref={ref}
                    i18n={i18n}
                    style={style}
                    packs={installedPacks}
                    onClose={handleClose}
                    onClickAddPack={
                      onClickAddPack ? handleClickAddPack : undefined
                    }
                    onPickSticker={handlePickSticker}
                    onPickTimeSticker={
                      onPickTimeSticker ? handlePickTimeSticker : undefined
                    }
                    recentStickers={recentStickers}
                    showPickerHint={showPickerHint}
                  />
                </div>
              )}
            </Popper>,
            popperRoot
          )
        : null}
    </Manager>
  );
});
