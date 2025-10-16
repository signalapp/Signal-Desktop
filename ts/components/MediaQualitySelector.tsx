// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import lodash from 'lodash';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import { Manager, Popper, Reference } from 'react-popper';
import type { LocalizerType } from '../types/Util.std.js';
import { useRefMerger } from '../hooks/useRefMerger.std.js';
import { handleOutsideClick } from '../util/handleOutsideClick.dom.js';

const { noop } = lodash;

export type PropsType = {
  conversationId: string;
  i18n: LocalizerType;
  isHighQuality: boolean;
  onSelectQuality: (conversationId: string, isHQ: boolean) => unknown;
};

export function MediaQualitySelector({
  conversationId,
  i18n,
  isHighQuality,
  onSelectQuality,
}: PropsType): JSX.Element {
  const [menuShowing, setMenuShowing] = useState(false);
  const [popperRoot, setPopperRoot] = useState<HTMLElement | null>(null);
  const [focusedOption, setFocusedOption] = useState<0 | 1 | undefined>(
    undefined
  );

  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const refMerger = useRefMerger();

  const handleClick = () => {
    setMenuShowing(true);
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
      onSelectQuality(conversationId, Boolean(focusedOption));
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

      return () => {
        document.body.removeChild(root);
        setPopperRoot(null);
      };
    }

    return noop;
  }, [menuShowing, setPopperRoot, handleClose]);

  useEffect(() => {
    if (!menuShowing) {
      return noop;
    }

    return handleOutsideClick(
      () => {
        handleClose();
        return true;
      },
      {
        containerElements: [popperRoot, buttonRef],
        name: 'MediaQualitySelector',
      }
    );
  }, [menuShowing, popperRoot, handleClose]);

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <button
            aria-label={i18n('icu:MediaQualitySelector--button')}
            className={classNames({
              MediaQualitySelector__button: true,
              'MediaQualitySelector__button--hq': isHighQuality,
              'MediaQualitySelector__button--active': menuShowing,
            })}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            ref={refMerger(buttonRef, ref)}
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
                    {i18n('icu:MediaQualitySelector--title')}
                  </div>
                  <button
                    aria-label={i18n(
                      'icu:MediaQualitySelector--standard-quality-title'
                    )}
                    className={classNames({
                      MediaQualitySelector__option: true,
                      'MediaQualitySelector__option--focused':
                        focusedOption === 0,
                    })}
                    type="button"
                    onClick={() => {
                      onSelectQuality(conversationId, false);
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
                        {i18n(
                          'icu:MediaQualitySelector--standard-quality-title'
                        )}
                      </div>
                      <div className="MediaQualitySelector__option--description">
                        {i18n(
                          'icu:MediaQualitySelector--standard-quality-description'
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    aria-label={i18n(
                      'icu:MediaQualitySelector--high-quality-title'
                    )}
                    className={classNames({
                      MediaQualitySelector__option: true,
                      'MediaQualitySelector__option--focused':
                        focusedOption === 1,
                    })}
                    type="button"
                    onClick={() => {
                      onSelectQuality(conversationId, true);
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
                        {i18n('icu:MediaQualitySelector--high-quality-title')}
                      </div>
                      <div className="MediaQualitySelector__option--description">
                        {i18n(
                          'icu:MediaQualitySelector--high-quality-description'
                        )}
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
}
