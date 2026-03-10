// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent } from 'react';
import React, { useCallback, useRef, useState } from 'react';
import classNames from 'classnames';
import { Popover } from 'radix-ui';
import type { LocalizerType } from '../types/Util.std.js';
import { AxoIconButton } from '../axo/AxoIconButton.dom.js';

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
}: PropsType): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const standardRef = useRef<HTMLButtonElement>(null);
  const highRef = useRef<HTMLButtonElement>(null);

  const handleOpenAutoFocus = useCallback(
    (e: Event) => {
      e.preventDefault();
      if (isHighQuality) {
        highRef.current?.focus();
      } else {
        standardRef.current?.focus();
      }
    },
    [isHighQuality]
  );

  const handleContentKeyDown = useCallback((ev: KeyboardEvent) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (document.activeElement === standardRef.current) {
        highRef.current?.focus();
      } else {
        standardRef.current?.focus();
      }
      ev.stopPropagation();
      ev.preventDefault();
    }
  }, []);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <AxoIconButton.Root
          variant="borderless-secondary"
          size="md"
          symbol={isHighQuality ? 'hd' : 'hd-slash'}
          label={i18n('icu:MediaQualitySelector--button')}
          tooltip={false}
        />
      </Popover.Trigger>
      {open && (
        <Popover.Portal>
          <Popover.Content
            className="MediaQualitySelector__popper"
            side="top"
            align="start"
            sideOffset={4}
            onOpenAutoFocus={handleOpenAutoFocus}
            onKeyDown={handleContentKeyDown}
          >
            <div className="MediaQualitySelector__title">
              {i18n('icu:MediaQualitySelector--title')}
            </div>
            <button
              ref={standardRef}
              aria-label={i18n(
                'icu:MediaQualitySelector--standard-quality-title'
              )}
              className="MediaQualitySelector__option"
              type="button"
              onClick={() => {
                onSelectQuality(conversationId, false);
                setOpen(false);
              }}
            >
              <div
                className={classNames({
                  'MediaQualitySelector__option--checkmark': true,
                  'MediaQualitySelector__option--selected': !isHighQuality,
                })}
              />
              <div>
                <div className="MediaQualitySelector__option--title">
                  {i18n('icu:MediaQualitySelector--standard-quality-title')}
                </div>
                <div className="MediaQualitySelector__option--description">
                  {i18n(
                    'icu:MediaQualitySelector--standard-quality-description'
                  )}
                </div>
              </div>
            </button>
            <button
              ref={highRef}
              aria-label={i18n('icu:MediaQualitySelector--high-quality-title')}
              className="MediaQualitySelector__option"
              type="button"
              onClick={() => {
                onSelectQuality(conversationId, true);
                setOpen(false);
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
                  {i18n('icu:MediaQualitySelector--high-quality-description')}
                </div>
              </div>
            </button>
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}
