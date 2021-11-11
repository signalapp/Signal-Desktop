// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import { noop } from 'lodash';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { Manager, Popper, Reference } from 'react-popper';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  isHighQuality: boolean;
  onSelectQuality: (isHQ: boolean) => unknown;
};

export const MediaQualitySelector = ({
  i18n,
  isHighQuality,
  onSelectQuality,
}: PropsType): JSX.Element => {
  const [menuShowing, setMenuShowing] = useState(false);
  const [popperRoot, setPopperRoot] = useState<HTMLElement | null>(null);
  const [focusedOption, setFocusedOption] = useState<0 | 1 | undefined>(
    undefined
  );

  // We use regular MouseEvent below, and this one uses React.MouseEvent
  const handleClick = (ev: KeyboardEvent | React.MouseEvent) => {
    setMenuShowing(true);
    ev.stopPropagation();
    ev.preventDefault();
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (!popperRoot) {
      if (ev.key === 'Enter') {
        setFocusedOption(isHighQuality ? 1 : 0);
      }
      return;
    }

    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      setFocusedOption(oldFocusedOption => (oldFocusedOption === 1 ? 0 : 1));
      ev.stopPropagation();
      ev.preventDefault();
    }

    if (ev.key === 'Enter') {
      onSelectQuality(Boolean(focusedOption));
      setMenuShowing(false);
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  const handleClose = useCallback(() => {
    setMenuShowing(false);
    setFocusedOption(undefined);
  }, [setMenuShowing]);

  useEffect(() => {
    if (menuShowing) {
      const root = document.createElement('div');
      setPopperRoot(root);
      document.body.appendChild(root);
      const handleOutsideClick = (event: MouseEvent) => {
        if (!root.contains(event.target as Node)) {
          handleClose();
          event.stopPropagation();
          event.preventDefault();
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
  }, [menuShowing, setPopperRoot, handleClose]);

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <button
            aria-label={i18n('MediaQualitySelector--button')}
            className={classNames({
              MediaQualitySelector__button: true,
              'MediaQualitySelector__button--hq': isHighQuality,
              'MediaQualitySelector__button--active': menuShowing,
            })}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            ref={ref}
            type="button"
          />
        )}
      </Reference>
      {menuShowing && popperRoot
        ? createPortal(
            <Popper placement="top-start" strategy="fixed">
              {({ ref, style, placement }) => (
                <div
                  className="MediaQualitySelector__popper"
                  data-placement={placement}
                  ref={ref}
                  style={style}
                >
                  <div className="MediaQualitySelector__title">
                    {i18n('MediaQualitySelector--title')}
                  </div>
                  <button
                    aria-label={i18n(
                      'MediaQualitySelector--standard-quality-title'
                    )}
                    className={classNames({
                      MediaQualitySelector__option: true,
                      'MediaQualitySelector__option--focused':
                        focusedOption === 0,
                    })}
                    type="button"
                    onClick={() => {
                      onSelectQuality(false);
                      setMenuShowing(false);
                    }}
                  >
                    <div
                      className={classNames({
                        'MediaQualitySelector__option--checkmark': true,
                        'MediaQualitySelector__option--selected':
                          !isHighQuality,
                      })}
                    />
                    <div>
                      <div className="MediaQualitySelector__option--title">
                        {i18n('MediaQualitySelector--standard-quality-title')}
                      </div>
                      <div className="MediaQualitySelector__option--description">
                        {i18n(
                          'MediaQualitySelector--standard-quality-description'
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    aria-label={i18n(
                      'MediaQualitySelector--high-quality-title'
                    )}
                    className={classNames({
                      MediaQualitySelector__option: true,
                      'MediaQualitySelector__option--focused':
                        focusedOption === 1,
                    })}
                    type="button"
                    onClick={() => {
                      onSelectQuality(true);
                      setMenuShowing(false);
                    }}
                  >
                    <div
                      className={classNames({
                        'MediaQualitySelector__option--checkmark': true,
                        'MediaQualitySelector__option--selected': isHighQuality,
                      })}
                    />
                    <div>
                      <div className="MediaQualitySelector__option--title">
                        {i18n('MediaQualitySelector--high-quality-title')}
                      </div>
                      <div className="MediaQualitySelector__option--description">
                        {i18n('MediaQualitySelector--high-quality-description')}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </Popper>,
            popperRoot
          )
        : null}
    </Manager>
  );
};
