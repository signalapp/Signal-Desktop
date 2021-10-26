// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Button, ButtonVariant } from './Button';
import type { LocalizerType } from '../types/Util';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

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

export const PermissionsPopup = ({
  i18n,
  message,
  onAccept,
  onClose,
}: PropsType): JSX.Element => {
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
          {i18n('confirmation-dialog--Cancel')}
        </Button>
        <Button
          onClick={onAccept}
          ref={focusRef}
          variant={ButtonVariant.Primary}
        >
          {i18n('allowAccess')}
        </Button>
      </div>
    </div>
  );
};
