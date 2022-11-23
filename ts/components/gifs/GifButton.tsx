import React from 'react';
import { Manager, Popper, Reference } from 'react-popper';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { noop } from 'lodash';
import type { LocalizerType } from '../../types/Util';
import type { Theme } from '../../util/theme';
import { themeClassName } from '../../util/theme';
import { useRefMerger } from '../../hooks/useRefMerger';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import { GifPicker } from './GifPicker';
import type { GifFromGiphyType } from '../../sql/Interface';
import type { GiphyRendererWrapper } from '../../services/GiphyRendererWrapper';

export type Props = Readonly<{
  className?: string;
  i18n: LocalizerType;
  recentGifs: Array<string>;
  onOpenStateChanged?: (isOpen: boolean) => void;
  onPickGif?: (gif: GifFromGiphyType) => void;
  position?: 'top-end' | 'top-start';
  theme?: Theme;
  giphyWrapper: GiphyRendererWrapper;
}>;

export const GifButton = React.memo(
  ({
    className,
    i18n,
    onOpenStateChanged,
    theme,
    onPickGif = noop,
    position = 'top-end',
    recentGifs,
    giphyWrapper,
  }: Props) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleSetIsOpen = React.useCallback(
      (value: boolean) => {
        setIsOpen(value);
        onOpenStateChanged?.(value);
      },
      [onOpenStateChanged, setIsOpen]
    );

    const handleClickButton = React.useCallback(() => {
      handleSetIsOpen(!isOpen);
    }, [handleSetIsOpen, isOpen]);

    const handleClose = React.useCallback(() => {
      handleSetIsOpen(false);
    }, [handleSetIsOpen]);

    const handleGifPicked = React.useCallback(
      (gif: GifFromGiphyType) => {
        handleSetIsOpen(false);
        onPickGif(gif);
      },
      [handleSetIsOpen, onPickGif]
    );

    const buttonRef = React.useRef<HTMLElement | null>(null);
    const refMerger = useRefMerger();
    const [popperRoot, setPopperRoot] = React.useState<HTMLElement | null>(
      null
    );

    // Create popper root and handle outside clicks
    React.useEffect(() => {
      if (isOpen) {
        const root = document.createElement('div');
        setPopperRoot(root);
        document.body.appendChild(root);

        return () => {
          document.body.removeChild(root);
          setPopperRoot(null);
        };
      }

      return noop;
    }, [isOpen, setPopperRoot]);

    React.useEffect(() => {
      if (!isOpen) {
        return noop;
      }

      return handleOutsideClick(
        () => {
          handleSetIsOpen(false);
          return true;
        },
        {
          containerElements: [popperRoot, buttonRef],
          name: 'GifButton',
        }
      );
    }, [isOpen, popperRoot, handleSetIsOpen]);

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
                  'module-gif-button__button': true,
                  'module-gif-button__button--active': isOpen,
                },
                className
              )}
              aria-label={i18n('gifs--GifPicker--Open')}
            />
          )}
        </Reference>
        {isOpen && popperRoot
          ? createPortal(
              <Popper placement={position}>
                {({ ref, style }) => (
                  <div className={theme ? themeClassName(theme) : undefined}>
                    <GifPicker
                      ref={ref}
                      style={style}
                      i18n={i18n}
                      onPickGif={handleGifPicked}
                      recentGifs={recentGifs}
                      showPickerHint={false}
                      onClose={handleClose}
                      giphyWrapper={giphyWrapper}
                    />
                  </div>
                )}
              </Popper>,
              popperRoot
            )
          : null}
      </Manager>
    );
  }
);
