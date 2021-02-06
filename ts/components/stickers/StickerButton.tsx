// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { get, noop } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';
import { StickerPicker } from './StickerPicker';
import { countStickers } from './lib';
import { StickerPackType, StickerType } from '../../state/ducks/stickers';
import { LocalizerType } from '../../types/Util';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly receivedPacks: ReadonlyArray<StickerPackType>;
  readonly installedPacks: ReadonlyArray<StickerPackType>;
  readonly blessedPacks: ReadonlyArray<StickerPackType>;
  readonly knownPacks: ReadonlyArray<StickerPackType>;
  readonly installedPack?: StickerPackType | null;
  readonly recentStickers: ReadonlyArray<StickerType>;
  readonly clearInstalledStickerPack: () => unknown;
  readonly onClickAddPack: () => unknown;
  readonly onPickSticker: (packId: string, stickerId: number) => unknown;
  readonly showIntroduction?: boolean;
  readonly clearShowIntroduction: () => unknown;
  readonly showPickerHint: boolean;
  readonly clearShowPickerHint: () => unknown;
  readonly position?: 'top-end' | 'top-start';
};

export type Props = OwnProps;

enum OpenState {
  HIDDEN = 0,
  VISIBLE,
  FADEOUT,
}

export const StickerButton = React.memo(
  ({
    i18n,
    clearInstalledStickerPack,
    onClickAddPack,
    onPickSticker,
    recentStickers,
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
  }: Props) => {
    const [openState, setOpenState] = React.useState<OpenState>(
      OpenState.HIDDEN
    );
    const [popperRoot, setPopperRoot] = React.useState<HTMLElement | null>(
      null
    );
    const isVisible = openState !== OpenState.HIDDEN;

    const hide = React.useCallback(() => {
      if (!isVisible) {
        return;
      }
      setOpenState(OpenState.FADEOUT);
      setTimeout(() => {
        setOpenState(OpenState.HIDDEN);
      }, 150);
    }, [isVisible, setOpenState]);

    const handleClickButton = React.useCallback(() => {
      // Clear tooltip state
      clearInstalledStickerPack();
      clearShowIntroduction();

      // Handle button click
      if (installedPacks.length === 0) {
        onClickAddPack();
      } else if (popperRoot) {
        hide();
      } else {
        setOpenState(OpenState.VISIBLE);
      }
    }, [
      clearInstalledStickerPack,
      clearShowIntroduction,
      installedPacks,
      onClickAddPack,
      popperRoot,
      setOpenState,
      hide,
    ]);

    const handlePickSticker = React.useCallback(
      (packId: string, stickerId: number) => {
        hide();
        onPickSticker(packId, stickerId);
      },
      [hide, onPickSticker]
    );

    const handleClose = React.useCallback(() => {
      hide();
    }, [hide]);

    const handleClickAddPack = React.useCallback(() => {
      hide();
      if (showPickerHint) {
        clearShowPickerHint();
      }
      onClickAddPack();
    }, [hide, onClickAddPack, showPickerHint, clearShowPickerHint]);

    const handleClearIntroduction = React.useCallback(() => {
      clearInstalledStickerPack();
      clearShowIntroduction();
    }, [clearInstalledStickerPack, clearShowIntroduction]);

    // Create popper root and handle outside clicks
    React.useEffect(() => {
      if (isVisible) {
        const root = document.createElement('div');
        setPopperRoot(root);
        document.body.appendChild(root);
        const handleOutsideClick = ({ target }: MouseEvent) => {
          const targetElement = target as HTMLElement;
          const className = targetElement ? targetElement.className || '' : '';

          // We need to special-case sticker picker header buttons, because they can
          //   disappear after being clicked, which breaks the .contains() check below.
          const isMissingButtonClass =
            !className ||
            className.indexOf('module-sticker-picker__header__button') < 0;

          if (!root.contains(targetElement) && isMissingButtonClass) {
            hide();
          }
        };
        document.addEventListener('click', handleOutsideClick);

        return () => {
          document.body.removeChild(root);
          document.removeEventListener('click', handleOutsideClick);
          setPopperRoot(null);
        };
      }

      return noop;
    }, [isVisible, hide, setPopperRoot]);

    // Install keyboard shortcut to open sticker picker
    React.useEffect(() => {
      const handleKeydown = (event: KeyboardEvent) => {
        const { ctrlKey, key, metaKey, shiftKey } = event;
        const commandKey = get(window, 'platform') === 'darwin' && metaKey;
        const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
        const commandOrCtrl = commandKey || controlKey;

        // We don't want to open up if the conversation has any panels open
        const panels = document.querySelectorAll('.conversation .panel');
        if (panels && panels.length > 1) {
          return;
        }

        if (commandOrCtrl && shiftKey && (key === 's' || key === 'S')) {
          event.stopPropagation();
          event.preventDefault();

          if (!isVisible) {
            setOpenState(OpenState.VISIBLE);
          } else {
            hide();
          }
        }
      };
      document.addEventListener('keydown', handleKeydown);

      return () => {
        document.removeEventListener('keydown', handleKeydown);
      };
    }, [isVisible, setOpenState, hide]);

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
              ref={ref}
              onClick={handleClickButton}
              className={classNames({
                'module-sticker-button__button': true,
                'module-sticker-button__button--active':
                  openState !== OpenState.HIDDEN,
              })}
              aria-label={i18n('stickers--StickerPicker--Open')}
            />
          )}
        </Reference>
        {!openState && !showIntroduction && installedPack ? (
          <Popper placement={position} key={installedPack.id}>
            {({ ref, style, placement, arrowProps }) => (
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
                    {installedPack.title}
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
            )}
          </Popper>
        ) : null}
        {!openState && showIntroduction ? (
          <Popper placement={position}>
            {({ ref, style, placement, arrowProps }) => (
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
                  alt={i18n('stickers--StickerManager--Introduction--Image')}
                />
                <div className="module-sticker-button__tooltip--introduction__meta">
                  <div className="module-sticker-button__tooltip--introduction__meta__title">
                    {i18n('stickers--StickerManager--Introduction--Title')}
                  </div>
                  <div className="module-sticker-button__tooltip--introduction__meta__subtitle">
                    {i18n('stickers--StickerManager--Introduction--Body')}
                  </div>
                </div>
                <div className="module-sticker-button__tooltip--introduction__close">
                  <button
                    type="button"
                    className="module-sticker-button__tooltip--introduction__close__button"
                    onClick={handleClearIntroduction}
                    aria-label={i18n('close')}
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
            )}
          </Popper>
        ) : null}
        {openState && popperRoot
          ? createPortal(
              <Popper placement={position}>
                {({ ref, style }) => (
                  <StickerPicker
                    ref={ref}
                    i18n={i18n}
                    style={style}
                    packs={installedPacks}
                    onClose={handleClose}
                    onClickAddPack={handleClickAddPack}
                    onPickSticker={handlePickSticker}
                    recentStickers={recentStickers}
                    showPickerHint={showPickerHint}
                    fadeout={openState === OpenState.FADEOUT}
                  />
                )}
              </Popper>,
              popperRoot
            )
          : null}
      </Manager>
    );
  }
);
