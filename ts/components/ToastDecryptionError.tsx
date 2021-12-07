// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { Toast } from './Toast';

export type ToastPropsType = {
  deviceId: number;
  name: string;
  onShowDebugLog: () => unknown;
};

type PropsType = {
  i18n: LocalizerType;
  onClose: () => unknown;
} & ToastPropsType;

export const ToastDecryptionError = ({
  deviceId,
  i18n,
  name,
  onClose,
  onShowDebugLog,
}: PropsType): JSX.Element => {
  return (
    <Toast
      autoDismissDisabled
      className="decryption-error"
      onClose={onClose}
      style={{ maxWidth: '500px' }}
      toastAction={{
        label: i18n('decryptionErrorToastAction'),
        onClick: onShowDebugLog,
      }}
    >
      {i18n('decryptionErrorToast', {
        name,
        deviceId,
      })}
    </Toast>
  );
};
