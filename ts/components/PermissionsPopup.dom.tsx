// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Button, ButtonVariant } from './Button.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.js';

export type PropsType = {
  i18n: LocalizerType;
  message: string;
  onAccept: () => unknown;
  onClose: () => unknown;
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
}: PropsType): JSX.Element {
  useEscapeHandling(onClose);

  return (
    <div className="PermissionsPopup">
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
