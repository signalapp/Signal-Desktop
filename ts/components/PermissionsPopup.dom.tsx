// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef } from 'react';
import type { JSX } from 'react';

import { Button, ButtonVariant } from './Button.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.ts';
import { useSizeObserver } from '../hooks/useSizeObserver.dom.tsx';

export type PropsType = {
  i18n: LocalizerType;
  message: string;
  onAccept: () => unknown;
  onClose: () => unknown;
  onHeightChange: (height: number) => unknown;
};

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export function PermissionsPopup({
  i18n,
  message,
  onAccept,
  onClose,
  onHeightChange,
}: PropsType): JSX.Element {
  useEscapeHandling(onClose);

  const containerRef = useRef<HTMLDivElement | null>(null);
  useSizeObserver(containerRef, size => {
    if (!size.hidden) {
      onHeightChange(Math.ceil(size.height));
    }
  });

  return (
    <div className="PermissionsPopup" ref={containerRef}>
      <div className="PermissionsPopup__body">{message}</div>
      <div className="PermissionsPopup__buttons">
        <Button
          onClick={onClose}
          ref={focusRef}
          variant={ButtonVariant.Secondary}
        >
          {i18n('icu:confirmation-dialog--Cancel')}
        </Button>
        <Button
          onClick={onAccept}
          ref={focusRef}
          variant={ButtonVariant.Primary}
        >
          {i18n('icu:allowAccess')}
        </Button>
      </div>
    </div>
  );
}
