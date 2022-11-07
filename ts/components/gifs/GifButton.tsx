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

export type Props = Readonly<{
  className?: string;
  i18n: LocalizerType;
  recentGifs: ReadonlyArray<unknown>;
  onOpenStateChanged?: (isOpen: boolean) => void;
  onPickGif?: () => void;
  position: 'top-end' | 'top-start';
  theme?: Theme;
}>;

export const GifButton = React.memo(
  ({ className, i18n, onOpenStateChanged, theme, onPickGif = noop }: Props) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const buttonRef = React.useRef<HTMLElement | null>(null);
    const refMerger = useRefMerger();

    const handleSetIsOpen = React.useCallback(
      (value: boolean) => {
        setIsOpen(value);
        onOpenStateChanged?.(value);
      },
      [onOpenStateChanged, setIsOpen]
    );

    const handleClickButton = () => {
      handleSetIsOpen(!isOpen);
    };

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
        target => {
          const targetElement = target as HTMLElement;
          const targetClassName = targetElement
            ? targetElement.className || ''
            : '';

          // We need to special-case sticker picker header buttons, because they can
          //   disappear after being clicked, which breaks the .contains() check below.
          const isMissingButtonClass =
            !targetClassName ||
            targetClassName.indexOf('module-sticker-picker__header__button') <
              0;

          if (!isMissingButtonClass) {
            return false;
          }

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
              <Popper>
                {({ ref, style }) => (
                  <div className={theme ? themeClassName(theme) : undefined}>
                    <GifPicker
                      ref={ref}
                      style={style}
                      i18n={i18n}
                      onPickGif={onPickGif}
                      recentGifs={[]}
                      showPickerHint={false}
                      onClose={noop}
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
