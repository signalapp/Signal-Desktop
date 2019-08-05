import * as React from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
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
};

export type Props = OwnProps;

export const StickerButton = React.memo(
  // tslint:disable-next-line max-func-body-length
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
  }: Props) => {
    const [open, setOpen] = React.useState(false);
    const [popperRoot, setPopperRoot] = React.useState<HTMLElement | null>(
      null
    );

    const handleClickButton = React.useCallback(
      () => {
        // Clear tooltip state
        clearInstalledStickerPack();
        clearShowIntroduction();

        // Handle button click
        if (installedPacks.length === 0) {
          onClickAddPack();
        } else if (popperRoot) {
          setOpen(false);
        } else {
          setOpen(true);
        }
      },
      [
        clearInstalledStickerPack,
        onClickAddPack,
        installedPacks,
        popperRoot,
        setOpen,
      ]
    );

    const handlePickSticker = React.useCallback(
      (packId: string, stickerId: number) => {
        setOpen(false);
        onPickSticker(packId, stickerId);
      },
      [setOpen, onPickSticker]
    );

    const handleClose = React.useCallback(
      () => {
        setOpen(false);
      },
      [setOpen]
    );

    const handleClickAddPack = React.useCallback(
      () => {
        setOpen(false);
        if (showPickerHint) {
          clearShowPickerHint();
        }
        onClickAddPack();
      },
      [onClickAddPack, showPickerHint, clearShowPickerHint]
    );

    const handleClearIntroduction = React.useCallback(
      () => {
        clearInstalledStickerPack();
        clearShowIntroduction();
      },
      [clearInstalledStickerPack, clearShowIntroduction]
    );

    // Create popper root and handle outside clicks
    React.useEffect(
      () => {
        if (open) {
          const root = document.createElement('div');
          setPopperRoot(root);
          document.body.appendChild(root);
          const handleOutsideClick = ({ target }: MouseEvent) => {
            const targetElement = target as HTMLElement;
            const className = targetElement
              ? targetElement.className || ''
              : '';

            // We need to special-case sticker picker header buttons, because they can
            //   disappear after being clicked, which breaks the .contains() check below.
            const isMissingButtonClass =
              !className ||
              className.indexOf('module-sticker-picker__header__button') < 0;

            if (!root.contains(targetElement) && isMissingButtonClass) {
              setOpen(false);
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
      },
      [open, setOpen, setPopperRoot]
    );

    // Clear the installed pack after one minute
    React.useEffect(
      () => {
        if (installedPack) {
          // tslint:disable-next-line:no-string-based-set-timeout
          const timerId = setTimeout(clearInstalledStickerPack, 60 * 1000);

          return () => {
            clearTimeout(timerId);
          };
        }

        return noop;
      },
      [installedPack, clearInstalledStickerPack]
    );

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
              ref={ref}
              onClick={handleClickButton}
              className={classNames({
                'module-sticker-button__button': true,
                'module-sticker-button__button--active': open,
              })}
            />
          )}
        </Reference>
        {!open && !showIntroduction && installedPack ? (
          <Popper placement="top-end" key={installedPack.id}>
            {({ ref, style, placement, arrowProps }) => (
              <div
                ref={ref}
                style={style}
                className="module-sticker-button__tooltip"
                role="button"
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
              </div>
            )}
          </Popper>
        ) : null}
        {!open && showIntroduction ? (
          <Popper placement="top-end">
            {({ ref, style, placement, arrowProps }) => (
              <div
                ref={ref}
                style={style}
                className={classNames(
                  'module-sticker-button__tooltip',
                  'module-sticker-button__tooltip--introduction'
                )}
                role="button"
                onClick={handleClearIntroduction}
              >
                {/* <div className="module-sticker-button__tooltip--introduction__image" /> */}
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
                    className="module-sticker-button__tooltip--introduction__close__button"
                    onClick={handleClearIntroduction}
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
              </div>
            )}
          </Popper>
        ) : null}
        {open && popperRoot
          ? createPortal(
              <Popper placement="top-end">
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
